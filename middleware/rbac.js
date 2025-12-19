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

            // Fetch user roles for this tenant (DB may store either `roleId` or enum `role`)
            // Include system-scoped roles (tenantId=null) as well as tenant-scoped
            const userRoles = await UserRole.findAll({ where: { userId, [Op.or]: [{ tenantId }, { tenantId: null }] } });
            if (!userRoles || userRoles.length === 0) {
                return res.status(403).json({ message: 'Forbidden: No roles assigned for this tenant' });
            }

            // Determine roleIds. Some deployments store `roleId` on user_roles,
            // others store `role` enum. Support both: if `roleId` present use it,
            // otherwise map enum values to Role records to get IDs.
            let roleIds = [];
            if (userRoles[0] && Object.prototype.hasOwnProperty.call(userRoles[0], 'roleId') && userRoles[0].roleId) {
                roleIds = userRoles.map(ur => ur.roleId);
            } else {
                // Map enum values like 'SUPER_ADMIN' -> 'Super Admin'
                const enumRoleNames = userRoles.map(ur => {
                    const r = ur.role || '';
                    const formatted = r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');
                    return formatted;
                });
                // Find matching Role records (system roles may have tenantId null)
                const roleRecords = await Role.findAll({
                    where: {
                        name: { [Op.in]: enumRoleNames }
                    }
                });
                roleIds = roleRecords.map(r => r.id);
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
            // Attach permission metadata to request for use in controllers
            // Provide userRoles as human-readable names where possible
            let userRoleNames = [];
            if (userRoles[0] && Object.prototype.hasOwnProperty.call(userRoles[0], 'roleId') && userRoles[0].roleId) {
                // Attempt to fetch Role names
                const rolesFound = await Role.findAll({ where: { id: { [Op.in]: roleIds } } });
                userRoleNames = rolesFound.map(r => r.name);
            } else {
                userRoleNames = userRoles.map(ur => {
                    const r = ur.role || '';
                    return r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');
                });
            }

            req.permission = {
                resource,
                action,
                level: maxLevel,
                userRoles: userRoleNames
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
    const RolePermission = require('../models/RolePermission');
    const Permission = require('../models/Permission');

    // Include system-scoped roles (tenantId=null) so Super Admin entries are found
    const userRoles = await UserRole.findAll({ where: { userId: user.id, [Op.or]: [{ tenantId: user.tenantId }, { tenantId: null }] } });

    if (!userRoles || userRoles.length === 0) {
        return 'none';
    }

    // Determine roleIds (support both roleId and role enum)
    let roleIds = [];
    if (userRoles[0] && Object.prototype.hasOwnProperty.call(userRoles[0], 'roleId') && userRoles[0].roleId) {
        roleIds = userRoles.map(ur => ur.roleId);
    } else {
        const enumRoleNames = userRoles.map(ur => {
            const r = ur.role || '';
            const formatted = r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');
            return formatted;
        });
        const Role = require('../models/Role');
        const roleRecords = await Role.findAll({ where: { name: { [Op.in]: enumRoleNames } } });
        roleIds = roleRecords.map(r => r.id);
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

module.exports = {
    authorize,
    checkPermission
};
