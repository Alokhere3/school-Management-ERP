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

const { Op } = require('sequelize');

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

            const userId = req.user.id;
            const tenantId = req.user.tenantId;

            // Import models here to avoid circular dependencies
            const UserRole = require('../models/UserRole');
            const Role = require('../models/Role');
            const RolePermission = require('../models/RolePermission');
            const Permission = require('../models/Permission');

            // Fetch user roles for this tenant
            const userRoles = await UserRole.findAll({
                where: { userId, tenantId }
            });

            if (!userRoles || userRoles.length === 0) {
                return res.status(403).json({ message: 'Forbidden: No roles assigned for this tenant' });
            }

            // Shortcut: allow tenant admin roles to fully manage certain tenant-scoped resources
            // CRITICAL: Use req.userContext.roles (from enhancedRls middleware) not req.user.roles
            const contextRoles = req.userContext?.roles || [];
            const contextRolesUpper = contextRoles.map(r => typeof r === 'string' ? r.toUpperCase().replace(/\s+/g, '_') : r);
            
            if (resource === 'classes') {
                if (contextRolesUpper.includes('SUPER_ADMIN')) {
                    return res.status(403).json({ message: 'Forbidden: Super admin cannot access tenant classes' });
                }
                if (contextRolesUpper.some(r => typeof r === 'string' && r.endsWith('_ADMIN'))) {
                    // Grant full access for tenant admin roles without consulting RolePermission table
                    req.permission = { resource, action, level: 'full', userRoles: contextRoles };
                    return next();
                }
            }

            // Get role names from the user roles and find matching Role records
            const roleNames = userRoles.map(ur => enumToRoleName(ur.role));
            const roleRecords = await Role.findAll({
                where: { name: { [Op.in]: roleNames } }
            });

            const roleIds = roleRecords.map(r => r.id);

            if (roleIds.length === 0) {
                return res.status(403).json({ message: 'Forbidden: No matching roles found' });
            }

            // Fetch all permissions assigned to these roles for this resource+action
            const rolePermissions = await RolePermission.findAll({
                where: { roleId: { [Op.in]: roleIds } },
                include: [
                    {
                        model: Permission,
                        as: 'permission',
                        where: { resource, action },
                        required: true
                    }
                ]
            });

            // Determine the highest permission level granted
            let maxLevel = 'none';
            const levels = ['none', 'read', 'limited', 'full'];

            rolePermissions.forEach(rp => {
                const currentIndex = levels.indexOf(rp.level || 'none');
                const maxIndex = levels.indexOf(maxLevel);
                if (currentIndex > maxIndex) {
                    maxLevel = rp.level;
                }
            });

            if (maxLevel === 'none') {
                return res.status(403).json({
                    message: `Forbidden: No ${action} permission on ${resource}`
                });
            }

            // Attach permission metadata to request for use in controllers
            req.permission = {
                resource,
                action,
                level: maxLevel,
                userRoles: roleRecords.map(r => r.name)
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

    const UserRole = require('../models/UserRole');
    const Role = require('../models/Role');
    const RolePermission = require('../models/RolePermission');
    const Permission = require('../models/Permission');

    const userRoles = await UserRole.findAll({
        where: { userId: user.id, tenantId: user.tenantId }
    });

    if (!userRoles || userRoles.length === 0) {
        return 'none';
    }

    // Get role names from the user roles and find matching Role records
    const roleNames = userRoles.map(ur => enumToRoleName(ur.role));
    const roleRecords = await Role.findAll({
        where: { name: { [Op.in]: roleNames } }
    });

    const roleIds = roleRecords.map(r => r.id);

    if (roleIds.length === 0) {
        return 'none';
    }

    const rolePermissions = await RolePermission.findAll({
        where: { roleId: { [Op.in]: roleIds } },
        include: [
            {
                model: Permission,
                as: 'permission',
                where: { resource, action },
                required: true
            }
        ]
    });

    const levels = ['none', 'read', 'limited', 'full'];
    let maxLevel = 'none';

    rolePermissions.forEach(rp => {
        const currentIndex = levels.indexOf(rp.level || 'none');
        const maxIndex = levels.indexOf(maxLevel);
        if (currentIndex > maxIndex) {
            maxLevel = rp.level;
        }
    });

    return maxLevel;
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
