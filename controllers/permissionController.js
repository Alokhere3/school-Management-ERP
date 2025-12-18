/**
 * Permission Controller
 * Handles permission-related operations
 */
const asyncHandler = require('../utils/asyncHandler');
const Permission = require('../models/Permission');
const { sendError } = require('../utils/errorMapper');

/**
 * GET /api/permissions/modules
 * Get all available modules and their actions
 */
const getModules = asyncHandler(async (req, res) => {
    try {
        const permissions = await Permission.findAll({
            order: [['resource', 'ASC'], ['action', 'ASC']]
        });

        // Group by module
        const modules = {};
        permissions.forEach(perm => {
            if (!modules[perm.resource]) {
                modules[perm.resource] = {
                    module: perm.resource,
                    actions: []
                };
            }
            if (!modules[perm.resource].actions.includes(perm.action)) {
                modules[perm.resource].actions.push(perm.action);
            }
        });

        res.json({
            success: true,
            data: Object.values(modules)
        });
    } catch (error) {
        return sendError(res, error, 'Failed to get modules');
    }
});

module.exports = {
    getModules
};
