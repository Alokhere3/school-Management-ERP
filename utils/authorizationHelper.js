/**
 * Authorization Helper: Get user's allowed access
 * Returns a map of module → allowed actions based on user's roles
 */
const { UserRole, Role, RolePermission, Permission } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all allowed access for a user in a specific tenant
 * Returns: { module_name: ['read', 'create', ...], ... }
 * 
 * Note: This function works with the existing Role/RolePermission system.
 * If UserRole uses ENUM roles directly, we map them to Role names first.
 */
async function getAllowedAccess(userId, tenantId) {
    try {
        // Get user's roles in this tenant (ENUM-based)
        const userRoles = await UserRole.findAll({
            where: { userId, tenantId }
        });

        if (!userRoles || userRoles.length === 0) {
            return {};
        }

        // Map ENUM roles to Role names for RBAC lookup
        const roleNames = userRoles.map(ur => {
            // Convert ENUM to Role name format (e.g., 'TEACHER' -> 'Teacher')
            const roleEnum = ur.role;
            return roleEnum.charAt(0) + roleEnum.slice(1).toLowerCase().replace(/_/g, ' ');
        });

        // Find Role records by name
        const roles = await Role.findAll({
            where: {
                name: { [Op.in]: roleNames },
                [Op.or]: [
                    { tenantId: tenantId },
                    { isSystemRole: true }
                ]
            }
        });

        if (!roles || roles.length === 0) {
            return {};
        }

        const roleIds = roles.map(r => r.id);

        // Get all role-permission mappings for these roles
        const rolePermissions = await RolePermission.findAll({
            where: {
                roleId: { [Op.in]: roleIds },
                level: { [Op.ne]: 'none' }  // Exclude denied permissions
            },
            include: [{ association: 'permission', model: Permission }]
        });

        // Build allowed access map: { 'students': ['read', 'create', ...], ... }
        const allowedAccess = {};
        
        rolePermissions.forEach(rp => {
            if (!rp.permission) return;
            const resource = rp.permission.resource;
            const action = rp.permission.action;
            
            if (!allowedAccess[resource]) {
                allowedAccess[resource] = [];
            }
            
            // Only add if not already present
            if (!allowedAccess[resource].includes(action)) {
                allowedAccess[resource].push(action);
            }
        });

        return allowedAccess;
    } catch (error) {
        console.error('Error getting allowed access:', error.message);
        return {};
    }
}

/**
 * Get user's primary role in a tenant
 * Returns the first role from UserRole (ENUM-based)
 */
async function getUserPrimaryRole(userId, tenantId) {
    try {
        const userRole = await UserRole.findOne({
            where: { userId, tenantId },
            order: [['createdAt', 'ASC']] // Get first assigned role
        });

        if (!userRole) {
            return null;
        }

        // Try to find corresponding Role record for backward compatibility
        const roleName = userRole.role.charAt(0) + userRole.role.slice(1).toLowerCase().replace(/_/g, ' ');
        const role = await Role.findOne({
            where: {
                name: roleName,
                [Op.or]: [
                    { tenantId: tenantId },
                    { isSystemRole: true }
                ]
            }
        });

        return role || { name: roleName, id: null };
    } catch (error) {
        console.error('Error getting user role:', error.message);
        return null;
    }
}

module.exports = {
    getAllowedAccess,
    getUserPrimaryRole
};
