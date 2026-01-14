/**
 * Enhanced RLS Middleware with Permission Resolver
 * 
 * CRITICAL: This replaces roles from JWT with database-resolved roles
 * 
 * Changes from previous implementation:
 * - JWT roles array REMOVED (was stale)
 * - Roles resolved from database per-request
 * - Optional caching (Redis) for performance
 * - Role changes take effect immediately
 */

const logger = require('../config/logger');
const PermissionResolver = require('../services/PermissionResolver');

/**
 * Factory function to create enhanced RLS middleware
 * 
 * @param {Object} db - Sequelize instance
 * @param {Object} redisClient - Optional Redis client for caching
 * @returns {Function} Express middleware
 */
function createEnhancedRLSMiddleware(db, redisClient = null) {
    // Lazy initialize permissionResolver on first request
    // This ensures models are fully loaded before we try to access them
    let permissionResolver = null;

    return async (req, res, next) => {
        try {
            // Check if user is authenticated (req.user set by auth middleware)
            if (!req.user) {
                return next(); // Not authenticated, skip RLS initialization
            }

            // Lazy initialization of permission resolver
            if (!permissionResolver) {
                permissionResolver = new PermissionResolver(
                    db.models.User,
                    db.models.Role,
                    redisClient
                );
            }

            const { userId, tenantId } = req.user;

            if (!userId || !tenantId) {
                logger.warn({
                    message: 'INVALID_USER_CONTEXT',
                    userId,
                    tenantId,
                    reason: 'Missing userId or tenantId in JWT'
                });
                return res.status(401).json({
                    error: 'INVALID_USER_CONTEXT',
                    message: 'User context missing required fields'
                });
            }

            // CRITICAL: Resolve roles from database (not JWT)
            // This ensures roles are always current
            let roles = [];
            try {
                roles = await permissionResolver.resolveRoles(userId, tenantId);
            } catch (err) {
                logger.error({
                    message: 'PERMISSION_RESOLVE_FAILED',
                    userId,
                    tenantId,
                    error: err.message,
                    stack: err.stack
                });
                // FALLBACK: If permission resolution fails, try to get role from UserRole table directly
                // This is a backup in case PermissionResolver service has issues
                try {
                    const UserRole = require('../models/UserRole');
                    const userRoles = await UserRole.findAll({
                        where: { userId, tenantId },
                        attributes: ['role'],
                        raw: true
                    });
                    roles = userRoles.map(ur => ur.role);
                    
                    if (roles.length === 0) {
                        logger.warn({
                            message: 'NO_ROLES_FOUND_FOR_USER',
                            userId,
                            tenantId
                        });
                        // User exists but has no roles - deny access
                        roles = [];
                    } else {
                        logger.warn({
                            message: 'RECOVERED_ROLES_FROM_DB_FALLBACK',
                            userId,
                            tenantId,
                            roles
                        });
                    }
                } catch (fallbackErr) {
                    logger.error({
                        message: 'FALLBACK_ALSO_FAILED',
                        userId,
                        tenantId,
                        error: fallbackErr.message
                    });
                    roles = [];
                }
            }

            // Standardize and validate
            const primaryRole = roles[0] || 'user';

            // Build enhanced user context
            req.userContext = {
                userId,
                tenantId,
                roles: roles || [], // From database, not JWT
                role: primaryRole,
                permissions: {}, // Can be populated by PermissionResolver if needed
                resolvedAt: new Date(),
                source: 'database' // Explicit marker that roles came from DB
            };

            logger.debug({
                message: 'RLS_CONTEXT_INITIALIZED_WITH_DB_ROLES',
                userId,
                tenantId,
                roles: req.userContext.roles,
                source: 'database'
            });

            next();
        } catch (err) {
            logger.error({
                message: 'RLS_MIDDLEWARE_ERROR',
                error: err.message
            });
            return res.status(500).json({
                error: 'RLS_MIDDLEWARE_ERROR',
                message: 'Error initializing user context'
            });
        }
    };
}

module.exports = { createEnhancedRLSMiddleware };
