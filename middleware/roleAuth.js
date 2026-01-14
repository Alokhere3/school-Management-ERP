/**
 * Simple Role-Based Authorization Middleware
 * 
 * Checks if user's role matches any of the required roles (case-insensitive)
 * 
 * Usage:
 *   router.post('/teachers', 
 *     authenticateToken,
 *     requireRole(['admin', 'principal']),
 *     controller.createTeacher
 *   );
 */

const logger = require('../config/logger');

/**
 * Map database role names to simple role names
 * Handles both enum-style (SCHOOL_ADMIN) and simple (admin) formats
 * 
 * @param {string} role - Role name from database
 * @returns {string} Normalized role name
 */
function normalizeRole(role) {
    if (!role || typeof role !== 'string') {
        return '';
    }
    
    const upper = role.toUpperCase().trim().replace(/\s+/g, '_');
    
    // Map database enum values to simple names
    const roleMap = {
        'SCHOOL_ADMIN': 'admin',
        'ADMIN': 'admin',
        'SUPER_ADMIN': 'superadmin',
        'PRINCIPAL': 'principal',
        'TEACHER': 'teacher',
        'STAFF': 'staff',
        'STUDENT': 'student',
        'PARENT': 'parent',
        'ACCOUNTANT': 'accountant',
        'LIBRARIAN': 'librarian'
    };
    
    // If exact match in map, use mapped value
    if (roleMap[upper]) {
        return roleMap[upper];
    }
    
    // Otherwise return lowercase version
    return upper.toLowerCase();
}

/**
 * Middleware to check if user has one of the required roles
 * Performs case-insensitive role comparison with mapping
 * 
 * @param {Array<string>} requiredRoles - Array of role names (e.g., ['admin', 'principal'])
 * @returns {Function} Express middleware
 */
function requireRole(requiredRoles = []) {
    return (req, res, next) => {
        try {
            // Get user from request - check both req.user and req.userContext
            // req.userContext is set by enhancedRls middleware with database roles
            // req.user is set by authenticateToken middleware with JWT roles
            const userContext = req.userContext || req.user;
            
            if (!userContext) {
                logger.warn('[requireRole] No userContext or user in request');
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }

            // Get roles from user context - check multiple properties
            // req.userContext.roles (from enhancedRls middleware - database roles)
            // req.user.roles (from JWT)
            // req.user.role (fallback single role)
            const rawRoles = userContext.roles || (userContext.role ? [userContext.role] : []) || [];
            logger.info(`[requireRole] Raw roles from context: ${JSON.stringify(rawRoles)}`);
            
            if (rawRoles.length === 0) {
                logger.warn(`[requireRole] ❌ No roles found in userContext`);
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions - no roles assigned',
                    code: 'FORBIDDEN'
                });
            }
            
            const userRoles = rawRoles.map(r => {
                const normalized = normalizeRole(r);
                logger.info(`[requireRole] Mapping: '${r}' -> '${normalized}'`);
                return normalized;
            });
            
            // Normalize required roles to lowercase
            const normalizedRequired = requiredRoles
                .map(r => typeof r === 'string' ? r.toLowerCase().trim() : r);

            logger.info(`[requireRole] User ${userContext.userId || userContext.id}: userRoles=${JSON.stringify(userRoles)}, required=${JSON.stringify(normalizedRequired)}`);

            // Check if user has any of the required roles
            const hasRequiredRole = userRoles.some(role => {
                const match = normalizedRequired.includes(role);
                logger.info(`[requireRole]   Checking if '${role}' in ${JSON.stringify(normalizedRequired)}: ${match}`);
                return match;
            });

            if (!hasRequiredRole) {
                logger.warn(`[requireRole] ❌ User with roles ${JSON.stringify(userRoles)} does not have required roles ${JSON.stringify(normalizedRequired)}`);
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                    code: 'FORBIDDEN'
                });
            }

            logger.info(`[requireRole] ✅ User has required role(s)`);
            next();

        } catch (error) {
            logger.error(`[requireRole] ❌ Error: ${error.message}`);
            console.error(error);
            return res.status(500).json({
                success: false,
                error: 'Authorization check failed',
                code: 'AUTH_ERROR'
            });
        }
    };
}

module.exports = { requireRole, normalizeRole };
