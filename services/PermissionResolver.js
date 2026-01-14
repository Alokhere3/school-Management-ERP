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

            // Second: Query UserRole table directly for roles
            const UserRole = require('../models/UserRole');
            const userRoles = await UserRole.findAll({
                where: { userId, tenantId },
                attributes: ['role']
            });

            // Extract role names
            const roles = userRoles.map(ur => ur.role);

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
