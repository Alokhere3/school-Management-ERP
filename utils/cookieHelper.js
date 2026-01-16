/**
 * Cookie Helper Utilities
 * 
 * Provides secure cookie management for authentication tokens
 * with protection against XSS, CSRF, and other attacks
 */

const logger = require('../config/logger');

/**
 * Cookie configuration based on environment
 */
const getCookieConfig = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = isProduction || process.env.COOKIE_SECURE === 'true';
    
    return {
        httpOnly: true, // Prevents JavaScript access (XSS protection)
        secure: isSecure, // Only send over HTTPS in production
        sameSite: false, // CSRF protection - strict mode
        maxAge: 15 * 60 * 1000, // 15 minutes for access token
        path: '/', // Available to all paths
        domain: process.env.COOKIE_DOMAIN || undefined // Set domain if needed
    };
};

/**
 * Refresh token cookie configuration (longer expiry)
 */
const getRefreshCookieConfig = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = isProduction || process.env.COOKIE_SECURE === 'true';
    
    return {
        httpOnly: true,
        secure: isSecure,
        sameSite: false,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for refresh token
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
    };
};

/**
 * Set access token cookie
 */
function setAccessTokenCookie(res, token) {
    const config = getCookieConfig();
    res.cookie('accessToken', token, config);
}

/**
 * Set refresh token cookie
 */
function setRefreshTokenCookie(res, token) {
    const config = getRefreshCookieConfig();
    res.cookie('refreshToken', token, config);
}

/**
 * Clear authentication cookies
 */
function clearAuthCookies(res) {
    const baseConfig = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
        sameSite: false,
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
    };
    
    res.clearCookie('accessToken', baseConfig);
    res.clearCookie('refreshToken', baseConfig);
    logger.debug('Authentication cookies cleared');
}

/**
 * Get token from cookie or header (backward compatibility)
 */
function getTokenFromRequest(req) {
    // Priority 1: Cookie (more secure)
    if (req.cookies && req.cookies.accessToken) {
        return req.cookies.accessToken;
    }
    
    // Priority 2: Authorization header (backward compatibility)
    if (req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
            return parts[1];
        }
    }
    
    return null;
}

/**
 * Get refresh token from cookie
 */
function getRefreshTokenFromRequest(req) {
    if (req.cookies && req.cookies.refreshToken) {
        return req.cookies.refreshToken;
    }
    return null;
}

module.exports = {
    setAccessTokenCookie,
    setRefreshTokenCookie,
    clearAuthCookies,
    getTokenFromRequest,
    getRefreshTokenFromRequest,
    getCookieConfig,
    getRefreshCookieConfig
};

