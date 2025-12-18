/**
 * User Controller
 * Handles user profile and preference endpoints
 */
const asyncHandler = require('../utils/asyncHandler');
const { getAllowedAccess, getUserPrimaryRole } = require('../utils/authorizationHelper');
const User = require('../models/User');
const { sendError } = require('../utils/errorMapper');

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

module.exports = {
    getProfile
};
