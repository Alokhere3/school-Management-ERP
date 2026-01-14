/**
 * Tiered Rate Limiting Configuration
 * 
 * Previous limits were too weak for SaaS scale:
 * - authLimiter: 50/15min → 150/15min (3x increase)
 * - apiLimiter: 100/15min → 300/15min for authenticated users
 * 
 * New tiered approach:
 * 1. Unauthenticated (IP-based): 50/15min (strict)
 * 2. Basic User (authenticated): 300/15min
 * 3. Power User/Admin: 600/15min
 * 4. Internal/API: 2000/15min (with API key)
 * 
 * This prevents:
 * - Brute force attacks on auth endpoints
 * - Excessive API usage by basic users
 * - DoS attacks while allowing normal power user behavior
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const logger = require('../config/logger');

/**
 * Authentication endpoints limiter
 * Strict: 150 requests per 15 minutes per IP
 * (brute force protection)
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150, // Requests per window
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn({
            message: 'AUTH_RATE_LIMIT_EXCEEDED',
            ip: req.ip,
            timestamp: new Date().toISOString()
        });
        res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts. Please try again in 15 minutes.'
        });
    },
    // IPv6-safe: use helper from express-rate-limit
    keyGenerator: (req) => ipKeyGenerator(req)
});

/**
 * Basic user API limiter
 * 300 requests per 15 minutes per user
 * (normal app usage)
 */
const basicUserLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'API rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // For authenticated users, limit by userId instead of IP
        // Fallback to ipKeyGenerator for IPv6 safety
        if (req.user?.userId) return req.user.userId;
        return ipKeyGenerator(req);
    },
    handler: (req, res) => {
        logger.warn({
            message: 'API_RATE_LIMIT_EXCEEDED',
            userId: req.user?.userId,
            tier: 'basic',
            timestamp: new Date().toISOString()
        });
        res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'API rate limit exceeded. Standard users are limited to 300 requests per 15 minutes.',
            retryAfter: 900 // 15 minutes
        });
    }
});

/**
 * Power user/Admin limiter
 * 600 requests per 15 minutes per user
 * (administrative dashboards, bulk operations)
 */
const powerUserLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    message: 'API rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // For authenticated users, limit by userId instead of IP
        // Fallback to ipKeyGenerator for IPv6 safety
        if (req.user?.userId) return req.user.userId;
        return ipKeyGenerator(req);
    },
    handler: (req, res) => {
        logger.warn({
            message: 'API_RATE_LIMIT_EXCEEDED',
            userId: req.user?.userId,
            tier: 'power_user',
            timestamp: new Date().toISOString()
        });
        res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'API rate limit exceeded. Power users are limited to 600 requests per 15 minutes.',
            retryAfter: 900
        });
    }
});

/**
 * Internal API limiter
 * 2000 requests per 15 minutes with API key
 * (server-to-server communication, scheduled jobs)
 */
const internalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    message: 'API rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use API key if available, fallback to ipKeyGenerator for IPv6 safety
        if (req.headers['x-api-key']) return req.headers['x-api-key'];
        return ipKeyGenerator(req);
    },
    handler: (req, res) => {
        logger.warn({
            message: 'INTERNAL_API_RATE_LIMIT_EXCEEDED',
            apiKey: req.headers['x-api-key']?.substring(0, 10) + '***',
            tier: 'internal',
            timestamp: new Date().toISOString()
        });
        res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'API rate limit exceeded.',
            retryAfter: 900
        });
    }
});

/**
 * Unauthenticated user limiter (IP-based)
 * 50 requests per 15 minutes
 * (strict for security)
 */
const unauthenticatedLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.user !== undefined, // Skip if user is authenticated
    // IPv6-safe: use helper from express-rate-limit
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => {
        logger.warn({
            message: 'UNAUTHENTICATED_RATE_LIMIT_EXCEEDED',
            ip: req.ip,
            timestamp: new Date().toISOString()
        });
        res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please log in for higher rate limits.'
        });
    }
});

/**
 * Apply appropriate rate limiter based on user tier
 * 
 * Usage in server.js:
 *   app.use('/api/', applyTieredLimiter);
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
const applyTieredLimiter = (req, res, next) => {
    // Check if user has internal API key
    if (req.headers['x-api-key']) {
        return internalApiLimiter(req, res, next);
    }

    // Check if user is authenticated
    if (!req.user) {
        return unauthenticatedLimiter(req, res, next);
    }

    // Check if user is admin/power user
    const roles = req.user.roles || [req.user.role] || [];
    const isPowerUser = roles.some(r =>
        ['admin', 'super_admin', 'school_admin', 'principal', 'hr_manager']
            .includes(r.toLowerCase().replace(/\s+/g, '_'))
    );

    if (isPowerUser) {
        return powerUserLimiter(req, res, next);
    }

    // Default: basic user limiter
    return basicUserLimiter(req, res, next);
};

module.exports = {
    authLimiter,
    basicUserLimiter,
    powerUserLimiter,
    internalApiLimiter,
    unauthenticatedLimiter,
    applyTieredLimiter
};
