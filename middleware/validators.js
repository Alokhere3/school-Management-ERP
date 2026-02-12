const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/errorMapper');

// Standardized error handling middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        return sendError(res, {
            status: 400,
            body: {
                success: false,
                error: 'Validation error',
                code: 'VALIDATION_ERROR',
                details: errorMessages
            }
        });
    }
    next();
};

// Registration Validation Schema
const registerSchema = [
    body('name')
        .trim()
        .notEmpty().withMessage('Tenant name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Tenant name must be between 2 and 100 characters')
        .escape(), // Sanitize
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    body('roles')
        .optional()
        .isArray().withMessage('Roles must be an array')
        .custom((roles) => {
            if (!roles.every(role => typeof role === 'string')) {
                throw new Error('All roles must be strings');
            }
            return true;
        })
];

// Login Validation Schema
const loginSchema = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),
        
    body('password')
        .notEmpty().withMessage('Password is required')
];

// Reset Password Schema
const resetPasswordSchema = [
    body('tempToken')
        .notEmpty().withMessage('Temporary token is required'),
        
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

module.exports = {
    validate,
    registerSchema,
    loginSchema,
    resetPasswordSchema
};
