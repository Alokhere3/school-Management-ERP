/**
 * User Controller
 * Handles user management and profile operations
 */
const asyncHandler = require('../utils/asyncHandler');
const { getAllowedAccess, getUserPrimaryRole } = require('../utils/authorizationHelper');
const { User, UserRole, Role, Tenant } = require('../models'); // Changed from require('../models/User') to require('../models')
const { sendError } = require('../utils/errorMapper');
const { Op } = require('sequelize');

/**
 * GET /api/profile
 * Get current user's profile with roles and allowed access
 */
const getProfile = asyncHandler(async (req, res) => {
    try {
        const userId = req.user && req.user.id;
        const tenantId = req.user && (req.user.tenantId || req.user.tenantId);

        if (!userId || !tenantId) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Missing user context' });
        }

        // Get user details
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Get user's primary role and allowed access
        const primaryRole = await getUserPrimaryRole(userId, tenantId);
        const allowedAccess = await getAllowedAccess(userId, tenantId);

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                role: primaryRole ? primaryRole.name : user.role,
                roleDescription: primaryRole ? primaryRole.description : null,
                tenantId,
                allowedAccess,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        return sendError(res, error, 'Failed to get profile');
    }
});

/**
 * GET /api/users
 * List users with pagination and filtering
 */
const listUsers = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 10, search, roleId } = req.query;
        const tenantId = req.user.tenantId;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = { tenantId };

        if (search) {
            where[Op.or] = [
                { email: { [Op.like]: `%${search}%` } },
                // Add name search if name field exists in User or profile
            ];
        }

        // Includes for roles
        const include = [{
            model: UserRole,
            as: 'userRoles',
            where: { tenantId },
            required: false,
            include: [{
                model: Role,
                as: 'roleDetail',
                required: false
            }]
        }];

        // Filter by role if provided
        if (roleId) {
            include[0].required = true;
            include[0].where = { ...include[0].where, roleId };
        }

        const { count, rows } = await User.findAndCountAll({
            where,
            include,
            limit: parseInt(limit),
            offset,
            distinct: true // Important for correct count with includes
        });

        // Format response
        const users = rows.map(user => {
            const roles = user.userRoles.map(ur => ({
                id: ur.roleDetail?.id,
                name: ur.roleDetail?.name || ur.role, // Fallback to string if roleDetail missing
                isSystemRole: ur.roleDetail?.isSystemRole
            })).filter(r => r.id || r.name); // Filter empty

            return {
                id: user.id,
                email: user.email,
                status: user.status,
                roles,
                createdAt: user.createdAt
            };
        });

        res.json({
            success: true,
            data: users,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        return sendError(res, error, 'Failed to list users');
    }
});

/**
 * GET /api/users/:id
 * Get specific user details
 */
const getUserById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const user = await User.findOne({
            where: { id, tenantId },
            include: [{
                model: UserRole,
                as: 'userRoles',
                where: { tenantId },
                required: false,
                include: [{
                    model: Role,
                    as: 'roleDetail'
                }]
            }]
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const roles = user.userRoles.map(ur => ({
            id: ur.roleDetail?.id,
            name: ur.roleDetail?.name || ur.role,
            isSystemRole: ur.roleDetail?.isSystemRole,
            roleId: ur.roleId // return roleId explicitly
        }));

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                status: user.status,
                roles,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });

    } catch (error) {
        return sendError(res, error, 'Failed to get user');
    }
});

/**
 * PUT /api/users/:id/roles
 * Update roles for a user
 */
const updateUserRoles = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { roleIds } = req.body; // Expect array of role UUIDs
        const tenantId = req.user.tenantId;

        if (!Array.isArray(roleIds)) {
            return res.status(400).json({ success: false, error: 'roleIds must be an array' });
        }

        const user = await User.findOne({ where: { id, tenantId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Verify all roles exist and belong to tenant (or are system roles)
        const roles = await Role.findAll({
            where: {
                id: roleIds,
                [Op.or]: [
                    { tenantId },
                    { isSystemRole: true }
                ]
            }
        });

        if (roles.length !== roleIds.length) {
            return res.status(400).json({ success: false, error: 'One or more roles invalid or not found' });
        }

        // Transaction to update roles
        await User.sequelize.transaction(async (t) => {
            // Remove existing roles for this tenant
            await UserRole.destroy({
                where: {
                    userId: id,
                    tenantId
                },
                transaction: t
            });

            // Add new roles
            const userRolesData = roles.map(role => ({
                userId: id,
                tenantId,
                roleId: role.id,
                role: role.code || role.name.toUpperCase().replace(/[^A-Z0-9]/g, '_') // use code if available, else generate it
            }));

            if (userRolesData.length > 0) {
                await UserRole.bulkCreate(userRolesData, { transaction: t });
            }
        });

        res.json({ success: true, message: 'User roles updated successfully' });

    } catch (error) {
        return sendError(res, error, 'Failed to update user roles');
    }
});

module.exports = {
    getProfile,
    listUsers,
    getUserById,
    updateUserRoles
};
