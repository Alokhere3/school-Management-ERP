const authService = require('../services/authService');
const { sendError } = require('../utils/errorMapper');
const { setAccessTokenCookie, setRefreshTokenCookie } = require('../utils/cookieHelper');

const register = async (req, res) => {
    try {
        const result = await authService.registerTenant(req.body, req.user);

        setAccessTokenCookie(res, result.tokens.accessToken);
        setRefreshTokenCookie(res, result.tokens.refreshToken);

        res.status(201).json({
            success: true,
            user: {
                id: result.user.id,
                email: result.user.email,
                tenantId: result.user.tenantId,
                role: result.primaryRole,
                allowedAccess: result.allowedAccess,
                allowedRoutes: result.allowedRoutes
            },
            tenant: result.tenant
        });
    } catch (err) {
        sendError(res, err);
    }
};

const login = async (req, res) => {
    try {
        const result = await authService.loginUser(req.body);

        if (result.requiresPasswordReset) {
            return res.json({
                success: true,
                requiresPasswordReset: true,
                tempToken: result.tempToken,
                message: 'Password change required on first login'
            });
        }

        setAccessTokenCookie(res, result.tokens.accessToken);
        setRefreshTokenCookie(res, result.tokens.refreshToken);

        res.json({
            success: true,
            user: {
                id: result.user.id,
                email: result.user.email,
                tenantId: result.user.tenantId,
                role: result.primaryRole,
                allowedAccess: result.allowedAccess,
                allowedRoutes: result.allowedRoutes
            }
        });
    } catch (err) {
        sendError(res, err);
    }
};

const resetPassword = async (req, res) => {
    try {
        const result = await authService.resetPassword(req.body);

        setAccessTokenCookie(res, result.tokens.accessToken);
        setRefreshTokenCookie(res, result.tokens.refreshToken);

        res.json({ success: true });
    } catch (err) {
        sendError(res, err);
    }
};

module.exports = {
    register,
    login,
    resetPassword
};
