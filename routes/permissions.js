const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const asyncHandler = require('../utils/asyncHandler');
const permissionController = require('../controllers/permissionController');

const router = express.Router();

/**
 * GET /api/permissions/modules
 * Get all available modules and their actions
 */
router.get('/modules', authenticateToken, authorize('user_management', 'read'), asyncHandler(permissionController.getModules));

module.exports = router;
