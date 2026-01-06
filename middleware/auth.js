
const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/errorMapper');
const { getTokenFromRequest } = require('../utils/cookieHelper');

const authenticateToken = (req, res, next) => {
    try {
        // Get token from cookie (preferred) or Authorization header (backward compatibility)
        const token = getTokenFromRequest(req);
        
        if (!token) {
            return sendError(res, { 
                status: 401, 
                body: { 
                    success: false, 
                    error: 'Authentication required', 
                    code: 'TOKEN_REQUIRED' 
                } 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Normalize user object (support both old and new token formats)
        req.user = {
            userId: decoded.userId || decoded.id,
            tenantId: decoded.tenantId,
            roles: decoded.roles || (decoded.role ? [decoded.role] : []),
            role: decoded.roles && decoded.roles.length > 0 ? decoded.roles[0] : decoded.role,
            id: decoded.userId || decoded.id // Backward compatibility
        };
        
        next();
    } catch (err) {
        // When JWT verification fails, return 401 with a clear code
        if (err.name === 'TokenExpiredError') {
            return sendError(res, { 
                status: 401, 
                body: { 
                    success: false, 
                    error: 'Token expired', 
                    code: 'TOKEN_EXPIRED' 
                } 
            });
        }
        return sendError(res, { 
            status: 401, 
            body: { 
                success: false, 
                error: 'Invalid token', 
                code: 'INVALID_TOKEN' 
            } 
        });
    }
};

const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

        // Convert allowedRoles to uppercase for comparison with ENUM values
        const allowedRolesUpper = allowedRoles.map(r => r.toUpperCase().replace(/\s+/g, '_'));
        const userRolesUpper = userRoles.map(r => typeof r === 'string' ? r.toUpperCase().replace(/\s+/g, '_') : r);

        const hasRole = allowedRolesUpper.some(role => userRolesUpper.includes(role));

        if (!hasRole) {
            return sendError(res, {
                status: 403,
                body: {
                    success: false,
                    error: 'Insufficient permissions',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    required: allowedRoles,
                    actual: userRoles
                }
            });
        }
        next();
    };
};

// Allow tenant-level admins (e.g., SCHOOL_ADMIN) but explicitly block SUPER_ADMIN
const requireTenantAdmin = () => {
    return (req, res, next) => {
        const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
        const userRolesUpper = userRoles.map(r => typeof r === 'string' ? r.toUpperCase().replace(/\s+/g, '_') : r);

        if (userRolesUpper.includes('SUPER_ADMIN')) {
            return sendError(res, {
                status: 403,
                body: { success: false, error: 'Super admin cannot perform this action', code: 'INSUFFICIENT_PERMISSIONS', required: ['Tenant Admin'], actual: userRoles }
            });
        }

        // Consider any role that ends with '_ADMIN' (e.g., SCHOOL_ADMIN) as tenant admin
        const isTenantAdmin = userRolesUpper.some(r => typeof r === 'string' && r.endsWith('_ADMIN'));
        if (!isTenantAdmin) {
            return sendError(res, {
                status: 403,
                body: { success: false, error: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS', required: ['Tenant Admin'], actual: userRoles }
            });
        }
        next();
    };
};

// Block SUPER_ADMIN from accessing tenant-only endpoints
const blockSuperAdmin = () => {
    return (req, res, next) => {
        const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
        const userRolesUpper = userRoles.map(r => typeof r === 'string' ? r.toUpperCase().replace(/\s+/g, '_') : r);
        if (userRolesUpper.includes('SUPER_ADMIN')) {
            return sendError(res, {
                status: 403,
                body: { success: false, error: 'Access denied for Super Admin', code: 'ACCESS_DENIED', actual: userRoles }
            });
        }
        next();
    };
};

const enforceTenantScope = (req, res, next) => {
    const resourceTenantId = req.params.tenantId || req.body.tenantId;
    
    if (resourceTenantId && resourceTenantId !== req.user.tenantId) {
        return sendError(res, { 
            status: 403, 
            body: { 
                success: false, 
                error: 'Cross-tenant access denied',
                code: 'CROSS_TENANT_ACCESS_DENIED'
            } 
        });
    }
    
    // Auto-inject tenantId into queries
    req.query.tenantId = req.user.tenantId;
    next();
};

module.exports = { authenticateToken, requireRole, requireTenantAdmin, blockSuperAdmin, enforceTenantScope };

