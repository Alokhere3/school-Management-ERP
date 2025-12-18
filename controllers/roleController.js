/**
 * Role Controller
 * Handles role management operations
 */
const asyncHandler = require('../utils/asyncHandler');
const Role = require('../models/Role');
const { sendError } = require('../utils/errorMapper');
const { Op } = require('sequelize');

/**
 * GET /api/roles
 * List all roles with pagination and filtering
 */
const listRoles = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 10, search, sortBy = 'name', sortOrder = 'ASC', tenantId } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const userTenantId = req.user.tenantId;

        // Build where clause
        const where = {};
        
        // School Admin can only see roles for their tenant (non-system roles)
        // Super Admin can see all roles
        const primaryRole = await require('../utils/authorizationHelper').getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin) {
            // School Admin: only see tenant-scoped roles for their tenant
            where[Op.or] = [
                { tenantId: userTenantId },
                { isSystemRole: false, tenantId: null } // Template roles
            ];
        } else {
            // Super Admin: can see all roles
            if (tenantId) {
                where[Op.or] = [
                    { tenantId },
                    { isSystemRole: true }
                ];
            }
        }

        // Search filter
        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        // Build order clause
        const order = [[sortBy, sortOrder.toUpperCase()]];

        const { count, rows } = await Role.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset,
            order
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        return sendError(res, error, 'Failed to list roles');
    }
});

/**
 * GET /api/roles/:id
 * Get role by ID
 */
const getRoleById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const userTenantId = req.user.tenantId;

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check access: School Admin can only access their tenant's roles
        const primaryRole = await require('../utils/authorizationHelper').getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin && role.tenantId && role.tenantId !== userTenantId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cannot access roles from other tenants' });
        }

        res.json({ success: true, data: role });
    } catch (error) {
        return sendError(res, error, 'Failed to get role');
    }
});

/**
 * POST /api/roles
 * Create a new role
 */
const createRole = asyncHandler(async (req, res) => {
    try {
        const { name, description } = req.body;
        const userTenantId = req.user.tenantId;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Role name is required' });
        }

        // School Admin can only create tenant-scoped roles
        const primaryRole = await require('../utils/authorizationHelper').getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';

        // Check if role name already exists for this tenant
        const existingRole = await Role.findOne({
            where: {
                name: name.trim(),
                tenantId: isSuperAdmin ? req.body.tenantId || null : userTenantId
            }
        });

        if (existingRole) {
            return res.status(409).json({ 
                success: false, 
                error: 'Role with this name already exists',
                code: 'ROLE_EXISTS'
            });
        }

        const role = await Role.create({
            name: name.trim(),
            description: description || null,
            tenantId: isSuperAdmin ? (req.body.tenantId || null) : userTenantId,
            isSystemRole: isSuperAdmin ? (req.body.isSystemRole || false) : false
        });

        res.status(201).json({ success: true, data: role });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ 
                success: false, 
                error: 'Role with this name already exists',
                code: 'ROLE_EXISTS'
            });
        }
        return sendError(res, error, 'Failed to create role');
    }
});

/**
 * PUT /api/roles/:id
 * Update a role
 */
const updateRole = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const userTenantId = req.user.tenantId;

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check access: School Admin can only update their tenant's roles
        const primaryRole = await require('../utils/authorizationHelper').getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin) {
            if (role.isSystemRole) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify system roles' });
            }
            if (role.tenantId !== userTenantId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify roles from other tenants' });
            }
        }

        // Check if new name conflicts with existing role
        if (name && name.trim() !== role.name) {
            const existingRole = await Role.findOne({
                where: {
                    name: name.trim(),
                    tenantId: role.tenantId,
                    id: { [Op.ne]: id }
                }
            });

            if (existingRole) {
                return res.status(409).json({ 
                    success: false, 
                    error: 'Role with this name already exists',
                    code: 'ROLE_EXISTS'
                });
            }
        }

        // Update role
        const updates = {};
        if (name) updates.name = name.trim();
        if (description !== undefined) updates.description = description;

        await role.update(updates);

        res.json({ success: true, data: role });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ 
                success: false, 
                error: 'Role with this name already exists',
                code: 'ROLE_EXISTS'
            });
        }
        return sendError(res, error, 'Failed to update role');
    }
});

/**
 * DELETE /api/roles/:id
 * Delete a role
 */
const deleteRole = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const userTenantId = req.user.tenantId;

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check access: School Admin can only delete their tenant's roles
        const primaryRole = await require('../utils/authorizationHelper').getUserPrimaryRole(req.user.id, userTenantId);
        const isSuperAdmin = primaryRole && primaryRole.isSystemRole && primaryRole.name === 'Super Admin';
        
        if (!isSuperAdmin) {
            if (role.isSystemRole) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot delete system roles' });
            }
            if (role.tenantId !== userTenantId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot delete roles from other tenants' });
            }
        }

        // Check if role is in use
        const UserRole = require('../models/UserRole');
        const userRoleCount = await UserRole.count({ where: { roleId: id } });
        
        if (userRoleCount > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot delete role: ${userRoleCount} user(s) are assigned this role`,
                code: 'ROLE_IN_USE'
            });
        }

        await role.destroy();

        res.status(204).end();
    } catch (error) {
        return sendError(res, error, 'Failed to delete role');
    }
});

module.exports = {
    listRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
};
