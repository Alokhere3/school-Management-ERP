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

        // 1. Prefer lookup by roleId (Rename-safe)
        const roleIds = userRoles.map(ur => ur.roleId).filter(id => id);

        // 2. Fallback: Map legacy ENUM roles to Role Names (e.g. 'TEACHER' -> 'Teacher')
        // Only for records where roleId is missing
        const legacyRoleNames = userRoles
            .filter(ur => !ur.roleId && ur.role)
            .map(ur => {
                const roleEnum = ur.role;
                return roleEnum.charAt(0) + roleEnum.slice(1).toLowerCase().replace(/_/g, ' ');
            });

        // Find Roles by ID OR Legacy Name
        const whereClause = {
            [Op.or]: [
                { tenantId: tenantId },
                { isSystemRole: true }
            ]
        };

        const lookupConditions = [];
        if (roleIds.length > 0) lookupConditions.push({ id: { [Op.in]: roleIds } });
        if (legacyRoleNames.length > 0) lookupConditions.push({ name: { [Op.in]: legacyRoleNames } });

        if (lookupConditions.length > 0) {
            whereClause[Op.and] = [{ [Op.or]: lookupConditions }];
        } else {
            // No valid IDs or Names found
            return {};
        }

        const roles = await Role.findAll({ where: whereClause });

        if (!roles || roles.length === 0) {
            return {};
        }

        const resolvedRoleIds = roles.map(r => r.id);

        // Get all role-permission mappings for these roles
        const rolePermissions = await RolePermission.findAll({
            where: {
                roleId: { [Op.in]: resolvedRoleIds },
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

        // Try to find corresponding Role record by code
        // UserRole.role is expected to match Role.code
        const roleCode = userRole.role;
        const role = await Role.findOne({
            where: {
                code: roleCode,
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

const ROUTE_PERMISSION_MAP = require('./routePermissionMap');

/**
 * Get allowed frontend routes based on user permissions
 * Returns: { routeKey: true/false, ... }
 */
/**
 * Get allowed frontend routes based on user permissions
 * Returns: { routeKey: true/false, ... }
 */
function getRouteAccess(allowedAccess, userRole = '') {
    const routeAccess = {};

    // Normalize role name
    const role = userRole ? userRole.toLowerCase() : '';

    // Helper to check if user has specific permission
    const hasPermission = (resource, action) => {
        return allowedAccess[resource] && allowedAccess[resource].includes(action);
    };

    for (const [routeKey, requirement] of Object.entries(ROUTE_PERMISSION_MAP)) {
        // --- Strict Dashboard Logic ---
        if (routeKey === 'adminDashboard') {
            routeAccess[routeKey] = ['school admin', 'super admin', 'principal', 'admin'].includes(role);
            continue;
        }
        if (routeKey === 'teacherDashboard') {
            routeAccess[routeKey] = role === 'teacher';
            continue;
        }
        if (routeKey === 'studentDashboard') {
            routeAccess[routeKey] = role === 'student';
            continue;
        }
        if (routeKey === 'parentDashboard') {
            routeAccess[routeKey] = role === 'parent';
            continue;
        }

        if (requirement === 'public' || requirement === 'authenticated') {
            routeAccess[routeKey] = true;
            continue;
        }

        const [resource, action] = requirement.split(':');

        // Check if user has the required resource permission
        // If action is specified, check for that specific action
        if (hasPermission(resource, action)) {
            routeAccess[routeKey] = true;
        } else {
            routeAccess[routeKey] = false;
        }
    }

    return routeAccess;
}

module.exports = {
    getAllowedAccess,
    getUserPrimaryRole,
    getRouteAccess
};
