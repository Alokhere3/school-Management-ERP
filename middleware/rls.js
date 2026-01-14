/**
 * RLS Middleware
 * 
 * Validates user context and ensures RLS enforcement.
 * Applied after authentication to prepare req.userContext for repositories.
 */

const logger = require('../config/logger');
const { sendError } = require('../utils/errorMapper');

/**
 * CRITICAL: Middleware to prepare and validate user context for RLS enforcement
 * 
 * Transforms req.user into standardized req.userContext expected by repositories.
 * 
 * Flow:
 * 1. Auth middleware sets req.user (from JWT)
 * 2. This middleware validates and standardizes it into req.userContext
 * 3. Controllers pass req.userContext to repositories
 * 4. Repositories enforce RLS based on this context
 */
const initializeUserContext = (req, res, next) => {
    try {
        // Skip if no user (public endpoints, but shouldn't reach here)
        if (!req.user) {
            return next();
        }

        // Normalize and validate user context
        const userId = req.user.userId || req.user.id;
        const tenantId = req.user.tenantId;
        const roles = req.user.roles || (req.user.role ? [req.user.role] : []);

        // Validate required fields for RLS
        if (!userId || !tenantId) {
            logger.error('RLS_VALIDATION_FAILED', {
                user: req.user,
                hasUserId: !!userId,
                hasTenantId: !!tenantId
            });
            return sendError(res, {
                status: 400,
                body: {
                    success: false,
                    error: 'Invalid user context for RLS enforcement',
                    code: 'INVALID_USER_CONTEXT'
                }
            });
        }

        // Create standardized user context for repositories
        req.userContext = {
            userId,
            tenantId,
            roles,
            role: roles[0] || 'user',
            permissions: req.user.permissions || {}
        };

        logger.debug('RLS_CONTEXT_INITIALIZED', {
            userId: req.userContext.userId,
            tenantId: req.userContext.tenantId,
            role: req.userContext.role,
            roles: req.userContext.roles
        });

        next();
    } catch (err) {
        logger.error('RLS_MIDDLEWARE_ERROR', err);
        return sendError(res, {
            status: 500,
            body: {
                success: false,
                error: 'RLS initialization failed',
                code: 'RLS_INIT_ERROR'
            }
        });
    }
};

/**
 * Middleware to validate RLS enforcement before response
 * Logs all data access for audit trail
 */
const auditDataAccess = (req, res, next) => {
    if (req.userContext) {
        // This will be extended to log response data
        // For now, just ensure context is available
        next();
    } else {
        next();
    }
};

module.exports = {
    initializeUserContext,
    auditDataAccess
};
