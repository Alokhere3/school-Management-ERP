/**
 * Role Permission Controller
 * Handles role-permission management operations
 */
const asyncHandler = require('../utils/asyncHandler');
const Role = require('../models/Role');
const { sendError } = require('../utils/errorMapper');
const { 
    getRolePermissions, 
    updateRolePermissions,
    updateSinglePermission,
    updateModulePermissions,
    setAllowAllForModule
} = require('../services/rolePermissionService');
const { getUserPrimaryRole } = require('../utils/authorizationHelper');

/**
 * GET /api/roles/:id/permissions
 * Get permissions for a role
 */
const getRolePermissionsHandler = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const userTenantId = req.user.tenantId;

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check access: School Admin can only access their tenant's roles
        const primaryRole = await getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin && role.tenantId && role.tenantId !== userTenantId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cannot access roles from other tenants' });
        }

        const permissions = await getRolePermissions(id);

        res.json({ success: true, data: permissions });
    } catch (error) {
        return sendError(res, error, 'Failed to get role permissions');
    }
});

/**
 * PUT /api/roles/:id/permissions
 * Update permissions for a role
 */
const updateRolePermissionsHandler = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;
        const userTenantId = req.user.tenantId;

        if (!permissions || !Array.isArray(permissions)) {
            return res.status(400).json({ success: false, error: 'Permissions array is required' });
        }

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check access: School Admin can only update their tenant's roles
        const primaryRole = await getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin) {
            if (role.isSystemRole) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify system role permissions' });
            }
            if (role.tenantId !== userTenantId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify roles from other tenants' });
            }
        }

        await updateRolePermissions(id, permissions);

        // Return updated permissions
        const updatedPermissions = await getRolePermissions(id);

        res.json({ success: true, data: updatedPermissions });
    } catch (error) {
        return sendError(res, error, 'Failed to update role permissions');
    }
});

/**
 * PUT /api/roles/:id/permissions/:module/:action
 * Update a single permission for a role
 */
const updateSinglePermissionHandler = asyncHandler(async (req, res) => {
    try {
        const { id, module, action } = req.params;
        const { level } = req.body;
        const userTenantId = req.user.tenantId;

        if (!level || !['none', 'read', 'limited', 'full'].includes(level)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid level. Must be one of: none, read, limited, full' 
            });
        }

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check access: School Admin can only update their tenant's roles
        const primaryRole = await getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin) {
            if (role.isSystemRole) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify system role permissions' });
            }
            if (role.tenantId !== userTenantId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify roles from other tenants' });
            }
        }

        await updateSinglePermission(id, module, action, level);

        // Return updated permissions for the module
        const allPermissions = await getRolePermissions(id);
        const modulePermissions = allPermissions.find(p => p.module === module);

        res.json({ 
            success: true, 
            data: modulePermissions || { module, permissions: {} },
            message: `Permission ${module}.${action} updated to ${level}`
        });
    } catch (error) {
        if (error.message && error.message.includes('Permission not found')) {
            return res.status(404).json({ success: false, error: error.message });
        }
        return sendError(res, error, 'Failed to update permission');
    }
});

/**
 * PUT /api/roles/:id/permissions/:module
 * Update all permissions for a specific module
 */
const updateModulePermissionsHandler = asyncHandler(async (req, res) => {
    try {
        const { id, module } = req.params;
        const { actions } = req.body;
        const userTenantId = req.user.tenantId;

        if (!actions || typeof actions !== 'object') {
            return res.status(400).json({ 
                success: false, 
                error: 'Actions object is required. Format: { create: "full", read: "full", update: "none", delete: "full", export: "read" }' 
            });
        }

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check access: School Admin can only update their tenant's roles
        const primaryRole = await getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin) {
            if (role.isSystemRole) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify system role permissions' });
            }
            if (role.tenantId !== userTenantId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify roles from other tenants' });
            }
        }

        await updateModulePermissions(id, module, actions);

        // Return updated permissions for the module
        const allPermissions = await getRolePermissions(id);
        const modulePermissions = allPermissions.find(p => p.module === module);

        res.json({ 
            success: true, 
            data: modulePermissions || { module, permissions: {} },
            message: `Permissions for module ${module} updated`
        });
    } catch (error) {
        return sendError(res, error, 'Failed to update module permissions');
    }
});

/**
 * PUT /api/roles/:id/permissions/:module/allow-all
 * Set "AllowAll" for a module (grants full access to all actions)
 */
const setAllowAllHandler = asyncHandler(async (req, res) => {
    try {
        const { id, module } = req.params;
        const { allowAll } = req.body;
        const userTenantId = req.user.tenantId;

        if (typeof allowAll !== 'boolean') {
            return res.status(400).json({ 
                success: false, 
                error: 'allowAll must be a boolean value' 
            });
        }

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check access: School Admin can only update their tenant's roles
        const primaryRole = await getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin) {
            if (role.isSystemRole) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify system role permissions' });
            }
            if (role.tenantId !== userTenantId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify roles from other tenants' });
            }
        }

        await setAllowAllForModule(id, module, allowAll);

        // Return updated permissions for the module
        const allPermissions = await getRolePermissions(id);
        const modulePermissions = allPermissions.find(p => p.module === module);

        res.json({ 
            success: true, 
            data: modulePermissions || { module, permissions: {} },
            message: `AllowAll for module ${module} set to ${allowAll}`
        });
    } catch (error) {
        return sendError(res, error, 'Failed to set AllowAll for module');
    }
});

module.exports = {
    getRolePermissions: getRolePermissionsHandler,
    updateRolePermissions: updateRolePermissionsHandler,
    updateSinglePermission: updateSinglePermissionHandler,
    updateModulePermissions: updateModulePermissionsHandler,
    setAllowAll: setAllowAllHandler
};
