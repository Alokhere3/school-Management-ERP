/**
 * Input Sanitization Middleware
 * Sanitizes all string inputs to prevent XSS attacks
 */
const sanitizeHtml = require('sanitize-html');

module.exports = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            const value = req.body[key];
            
            // Sanitize string values
            if (typeof value === 'string') {
                req.body[key] = sanitizeHtml(value, {
                    allowedTags: [],
                    allowedAttributes: {}
                });
            }
            
            // Sanitize nested objects (like onboardingData)
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                req.body[key] = sanitizeObject(value);
            }
            
            // Sanitize arrays of strings
            if (Array.isArray(value)) {
                req.body[key] = value.map(item => {
                    if (typeof item === 'string') {
                        return sanitizeHtml(item, {
                            allowedTags: [],
                            allowedAttributes: {}
                        });
                    }
                    return item;
                });
            }
        });
    }
    
    next();
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj) {
    const sanitized = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (typeof value === 'string') {
                sanitized[key] = sanitizeHtml(value, {
                    allowedTags: [],
                    allowedAttributes: {}
                });
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                sanitized[key] = sanitizeObject(value);
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => {
                    if (typeof item === 'string') {
                        return sanitizeHtml(item, {
                            allowedTags: [],
                            allowedAttributes: {}
                        });
                    }
                    return item;
                });
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
}
