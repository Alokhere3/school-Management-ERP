/**
 * PermissionResolver Service
 * 
 * Resolves user permissions from database instead of JWT.
 * CRITICAL FIX: Removes roles from JWT payload (was causing stale access issues)
 * 
 * Now JWT contains only: { userId, tenantId, type }
 * Permissions are resolved per-request from database (cached in Redis if available)
 * 
 * Changes from previous architecture:
 * BEFORE: JWT = { userId, tenantId, roles: ['teacher', 'admin'] }
 *         - Role changes require user re-login (stale tokens)
 *         - Access revocation delayed until token expires
 *         - Larger JWT payload
 * 
 * AFTER:  JWT = { userId, tenantId, type: 'user' }
 *         - Permissions always current (resolved from DB per-request)
 *         - Role changes take effect immediately
 *         - Smaller JWT payload for performance
 *         - Optional Redis cache for hot paths (5-10 min TTL)
 */

const logger = require('../config/logger');

class PermissionResolver {
    constructor(userModel, roleModel, cache = null) {
        this.userModel = userModel;
        this.roleModel = roleModel;
        this.cache = cache; // Optional Redis cache
        this.CACHE_TTL = 600; // 10 minutes
    }

    /**
     * Resolve user's roles and permissions
     * 
     * Lookup order:
     * 1. Check Redis cache (if available) - returns cached roles
     * 2. Query database for current roles
     * 3. Cache result for 10 minutes
     * 
     * @param {String} userId - User ID
     * @param {String} tenantId - Tenant ID
     * @returns {Promise<Array>} Array of role strings
     */
    async resolveRoles(userId, tenantId) {
        const cacheKey = `perms:${userId}:${tenantId}:roles`;

        // Try cache first
        if (this.cache) {
            try {
                const cached = await this.cache.get(cacheKey);
                if (cached) {
                    logger.debug({
                        message: 'PERMISSION_CACHE_HIT',
                        userId,
                        tenantId,
                        source: 'cache'
                    });
                    return JSON.parse(cached);
                }
            } catch (err) {
                logger.warn({
                    message: 'PERMISSION_CACHE_ERROR',
                    error: err.message,
                    userId,
                    tenantId
                });
                // Continue to database lookup on cache error
            }
        }

        // Resolve from database
        try {
            // First: Verify user exists
            const user = await this.userModel.findOne({
                where: { id: userId, tenantId },
                attributes: ['id', 'email', 'status']
            });

            if (!user) {
                logger.warn({
                    message: 'USER_NOT_FOUND_FOR_PERMISSION_RESOLVE',
                    userId,
                    tenantId
                });
                return [];
            }

            // Second: Query UserRole table with Role association
            const UserRole = require('../models/UserRole');
            const Role = require('../models/Role');

            const userRoles = await UserRole.findAll({
                where: { userId, tenantId },
                include: [{
                    model: Role,
                    as: 'roleDetail', // CRITICAL: Must match alias in models/index.js
                    attributes: ['code'],
                    required: true // Only return if Role exists (integrity check)
                }],
                attributes: ['id']
            });

            // Extract role codes
            // Note: Since we used 'as: roleDetail', the data is under .roleDetail, not .Role
            const roles = userRoles.map(ur => ur.roleDetail.code);

            if (roles.length === 0) {
                logger.warn({
                    message: 'NO_ROLES_FOUND_OR_ROLE_LINK_BROKEN',
                    userId,
                    tenantId
                });
            }

            // Cache the result
            if (this.cache && roles.length > 0) {
                try {
                    await this.cache.setex(
                        cacheKey,
                        this.CACHE_TTL,
                        JSON.stringify(roles)
                    );
                } catch (cacheErr) {
                    logger.warn({
                        message: 'PERMISSION_CACHE_SET_ERROR',
                        error: cacheErr.message
                    });
                    // Non-fatal: continue without caching
                }
            }

            logger.debug({
                message: 'PERMISSION_RESOLVED_FROM_DB',
                userId,
                tenantId,
                roles,
                source: 'database'
            });

            return roles;
        } catch (err) {
            logger.error({
                message: 'PERMISSION_RESOLVE_ERROR',
                error: err.message,
                userId,
                tenantId
            });
            throw err;
        }
    }

    /**
     * Resolve permissions for user
     * 
     * Rules:
     * 1. DENY overrides ALLOW
     * 2. ALLOW aggregates
     * 3. Scope = most permissive VALID scope (if conditions met)
     * 4. Conditions = ANDed
     * 5. Missing data = DENY
     */
    async resolvePermissions(userId, tenantId) {
        // 1. Get Roles
        const roleCodes = await this.resolveRoles(userId, tenantId);
        // Fallback: if role codes are missing, resolve by roleId directly (migration safety)
        let roleIds = [];
        if (roleCodes.length === 0) {
            try {
                const UserRole = require('../models/UserRole');
                const userRoles = await UserRole.findAll({
                    where: { userId, tenantId },
                    attributes: ['roleId'],
                    raw: true
                });
                roleIds = userRoles.map(ur => ur.roleId).filter(Boolean);
                if (roleIds.length === 0) return {};

                logger.warn({
                    message: 'ROLE_CODE_MISSING_FALLBACK_TO_ROLE_ID',
                    userId,
                    tenantId,
                    roleIdsCount: roleIds.length
                });
            } catch (err) {
                logger.error({
                    message: 'ROLE_ID_FALLBACK_FAILED',
                    userId,
                    tenantId,
                    error: err.message
                });
                return {};
            }
        }

        // 2. Fetch all role permissions
        const Role = require('../models/Role');
        const Permission = require('../models/Permission');
        const RolePermission = require('../models/RolePermission');
        const { Op } = require('sequelize');

        if (roleCodes.length > 0) {
            // We need to query Role -> RolePermission -> Permission
            // First get roleIds from codes.
            const roles = await Role.findAll({
                where: {
                    // CRITICAL FIX: Match roles by code, regardless of tenant
                    // This allows tenant-specific roles to inherit permissions from
                    // the System Role with the same code.
                    [Op.or]: [
                        { code: { [Op.in]: roleCodes }, tenantId: tenantId },
                        { code: { [Op.in]: roleCodes }, isSystemRole: true }
                    ]
                },
                attributes: ['id', 'code']
            });

            roleIds = roles.map(r => r.id);
        }

        const rawPermissions = await RolePermission.findAll({
            where: { roleId: roleIds },
            include: [{
                model: Permission,
                as: 'permission', // CRITICAL: Must match alias in models/index.js
                attributes: ['resource', 'action'],
                required: true
            }],
            raw: true,
            nest: true
        });

        // 3. Aggregate Logic
        // Map: "resource:action" -> { effect, scopes: [], conditions: [] }
        const permMap = {};

        for (const rp of rawPermissions) {
            // Note: with nest:true and alias 'permission', data is in rp.permission
            const key = `${rp.permission.resource}:${rp.permission.action}`;

            if (!permMap[key]) {
                permMap[key] = {
                    denied: false,
                    allowed: false,
                    scopes: [],
                    conditions: []
                };
            }

            // DENY overrides all
            if (rp.effect === 'deny') {
                permMap[key].denied = true;
                continue;
            }

            if (rp.effect === 'allow') {
                permMap[key].allowed = true;
                // Collect scope and conditions

                // Rule: custom scope without conditions -> DENY (ignored)
                if (rp.scope === 'custom' && (!rp.conditions || Object.keys(rp.conditions).length === 0)) {
                    continue;
                }

                permMap[key].scopes.push(rp.scope);
                if (rp.conditions) {
                    permMap[key].conditions.push(rp.conditions);
                }
            }
        }

        // 4. Resolve Final Policy
        const resolvedPolicy = {};

        const SCOPE_RANK = {
            'self': 1,
            'owned': 2,
            'tenant': 3,
            'custom': 0 // Custom handled via conditions
        };

        for (const [key, state] of Object.entries(permMap)) {
            // Rule 1: DENY overrides everything
            if (state.denied) {
                resolvedPolicy[key] = {
                    allowed: false,
                    reason: 'Explicit DENY'
                };
                continue;
            }

            // Rule 2: If not allowed by any role, it's denied (implicit deny)
            if (!state.allowed) {
                resolvedPolicy[key] = {
                    allowed: false,
                    reason: 'Implicit DENY'
                };
                continue;
            }

            // Rule 3: Resolve Scope
            // "Scope = most permissive valid scope"
            let maxScope = 'self'; // Default start
            let maxRank = -1;

            for (const scope of state.scopes) {
                const rank = SCOPE_RANK[scope] || 0;
                if (rank > maxRank) {
                    maxRank = rank;
                    maxScope = scope;
                }
            }

            // If only custom scopes exist (rank 0), maxScope will be 'custom' (if we init rank -1)
            if (maxRank === 0 && state.scopes.includes('custom') && maxScope === 'self') {
                maxScope = 'custom';
            }
            // Logic fix: if maxRank is still -1 (no scopes?), default to 'self' or error?
            // Should not happen if allowed=true.

            resolvedPolicy[key] = {
                allowed: true,
                scope: maxScope,
                conditions: state.conditions // Passing array of conditions
            };
        }

        return resolvedPolicy;
    }

    /**
     * Invalidate cached permissions (called when user roles change)
     * 
     * @param {String} userId - User ID
     * @param {String} tenantId - Tenant ID
     */
    async invalidateCache(userId, tenantId) {
        if (!this.cache) return;

        const cacheKey = `perms:${userId}:${tenantId}:roles`;
        try {
            await this.cache.del(cacheKey);
            logger.info({
                message: 'PERMISSION_CACHE_INVALIDATED',
                userId,
                tenantId
            });
        } catch (err) {
            logger.warn({
                message: 'PERMISSION_CACHE_INVALIDATE_ERROR',
                error: err.message
            });
        }
    }

    /**
     * Invalidate cache for all users with specific role
     * @param {String} roleId 
     * @param {String} tenantId
     */
    async invalidateRoleUsers(roleId, tenantId) {
        if (!this.cache) return;

        try {
            const UserRole = require('../models/UserRole');
            const users = await UserRole.findAll({
                where: { roleId, tenantId },
                attributes: ['userId']
            });

            for (const user of users) {
                await this.invalidateCache(user.userId, tenantId);
            }
            logger.info({
                message: 'ROLE_USERS_CACHE_INVALIDATED',
                roleId,
                tenantId,
                userCount: users.length
            });
        } catch (err) {
            logger.error({
                message: 'ROLE_USERS_INVALIDATE_FAILED',
                roleId,
                tenantId,
                error: err.message
            });
        }
    }

    /**
     * Check if user has specific permission/role
     * 
     * @param {String} userId - User ID
     * @param {String} tenantId - Tenant ID
     * @param {String} role - Role name to check
     * @returns {Promise<Boolean>}
     */
    async hasRole(userId, tenantId, role) {
        const roles = await this.resolveRoles(userId, tenantId);
        return roles.some(r => r.toLowerCase() === role.toLowerCase());
    }

    /**
     * Check if user is tenant admin
     * 
     * @param {String} userId - User ID
     * @param {String} tenantId - Tenant ID
     * @returns {Promise<Boolean>}
     */
    async isAdmin(userId, tenantId) {
        const roles = await this.resolveRoles(userId, tenantId);
        return roles.some(r =>
            ['admin', 'super_admin', 'school_admin', 'principal'].includes(
                r.toLowerCase().replace(/\s+/g, '_')
            )
        );
    }
}

module.exports = PermissionResolver;
