/**
 * RBAC Authorization Middleware
 * 
 * Checks if the authenticated user has permission to perform an action on a resource.
 * 
 * Usage in routes:
 *   router.get('/students', 
 *     authorize('students', 'read'),
 *     studentController.listStudents
 *   );
 * 
 *   router.post('/students',
 *     authorize('students', 'create'),
 *     studentController.createStudent
 *   );
 */

const ScopeResolver = require('../services/ScopeResolver');

/**
 * Convert enum role value (e.g., 'SUPER_ADMIN') to title case role name (e.g., 'Super Admin')
 * @param {string} enumValue - The enum value
 * @returns {string} - The title case role name
 */
function enumToRoleName(enumValue) {
    return enumValue
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Create an authorization middleware
 * @param {string} resource - Resource name (e.g., 'students', 'fees', 'attendance')
 * @param {string} action - Action ('create', 'read', 'update', 'delete', 'export')
 * @param {string} scope - Optional scope filter function for row-level security
 * @returns {Function} Express middleware
 */
function authorize(resource, action, scope = null) {
    return async (req, res, next) => {
        try {
            const logger = require('../config/logger');
            logger.debug(`Authorizing ${action} on ${resource} for user ${req.user?.id}`);
            // Ensure user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(401).json({ message: 'Unauthorized: No user in request' });
            }

            // Ensure tenant is set
            if (!req.user.tenantId) {
                return res.status(401).json({ message: 'Unauthorized: No tenant in request' });
            }

            if (!req.userContext) {
                logger.warn('User context not initialized for authorization');
                return res.status(500).json({ message: 'Authorization context missing' });
            }

            const resolved = ScopeResolver.resolve(req.userContext, resource, action);
            if (!resolved.allowed) {
                return res.status(403).json({
                    message: `Forbidden: No ${action} permission on ${resource}`,
                    reason: resolved.reason || 'DENIED'
                });
            }

            // Attach permission metadata to request for use in controllers
            req.permission = {
                resource,
                action,
                scope: resolved.scope || 'self',
                conditions: resolved.conditions || [],
                allowed: true
            };

            // Apply row-level scope filter if provided
            if (scope && typeof scope === 'function') {
                const scopeFilter = scope(req);
                req.scopeFilter = scopeFilter;
            }

            next();
        } catch (error) {
            const logger = require('../config/logger');
            logger.error('Authorization middleware error:', error);
            res.status(500).json({ message: 'Internal authorization error' });
        }
    };
}

/**
 * Helper: Check if user has permission without middleware
 * Useful for conditional logic inside controllers
 * @param {object} user - req.user object
 * @param {string} resource
 * @param {string} action
 * @returns {Promise<string>} - Permission level: 'none', 'read', 'limited', 'full'
 */
async function checkPermission(user, resource, action) {
    if (!user || !user.id || !user.tenantId) {
        return 'none';
    }

    const userContext = user.userContext || user;
    const resolved = ScopeResolver.resolve(userContext, resource, action);
    if (!resolved.allowed) return 'none';
    return resolved.scope || 'self';
}

/**
 * Middleware: Restrict access to SUPER_ADMIN role only
 * Used for system-level endpoints that should only be accessible to Super Admin users
 * 
 * CRITICAL: Checks req.userContext.roles which are resolved from database by enhancedRls middleware
 * This is the source of truth for user roles, not JWT tokens
 * 
 * @returns {Function} Express middleware
 */
function requireSuperAdmin(req, res, next) {
    try {
        const logger = require('../config/logger');
        
        // Ensure user is authenticated
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, error: 'Unauthorized: No user in request', code: 'NOT_AUTHENTICATED' });
        }

        // Check if user context has been initialized by enhancedRls middleware
        if (!req.userContext) {
            logger.warn(`User context not initialized for user ${req.user.id}`);
            return res.status(500).json({ 
                success: false, 
                error: 'Internal server error: User context not initialized',
                code: 'USER_CONTEXT_ERROR'
            });
        }

        // Get roles from userContext (these are resolved from database by enhancedRls middleware)
        const userRoles = req.userContext.roles || [];
        
        logger.debug(`Checking SUPER_ADMIN access for user ${req.user.id}. User roles: ${JSON.stringify(userRoles)}`);

        // Check if user has SUPER_ADMIN role
        const hasSuperAdminRole = userRoles.includes('SUPER_ADMIN');
        
        if (!hasSuperAdminRole) {
            logger.warn(`Super Admin access denied for user ${req.user.id}. Roles: ${JSON.stringify(userRoles)}`);
            return res.status(403).json({ 
                success: false, 
                error: 'Forbidden: Only Super Admin can access this resource',
                code: 'SUPER_ADMIN_REQUIRED'
            });
        }
        
        logger.debug(`Super Admin access granted for user ${req.user.id}`);
        next();

    } catch (error) {
        const logger = require('../config/logger');
        logger.error('Super Admin authorization middleware error:', error);
        res.status(500).json({ success: false, error: 'Internal authorization error', code: 'AUTH_ERROR' });
    }
}

module.exports = {
    authorize,
    checkPermission,
    requireSuperAdmin
};
