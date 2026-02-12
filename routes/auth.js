const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, registerSchema, loginSchema, resetPasswordSchema } = require('../middleware/validators');

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register tenant and admin
 *     description: Register a new tenant and create the initial admin user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantName
 *               - tenantType
 *               - adminName
 *               - adminEmail
 *               - password
 *             properties:
 *               tenantName:
 *                 type: string
 *               tenantType:
 *                 type: string
 *                 enum: [School, Institute, University]
 *               address:
 *                 type: string
 *               contactNumber:
 *                 type: string
 *               adminName:
 *                 type: string
 *               adminEmail:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 */
router.post('/register',
    registerSchema,
    validate,
    authController.register
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     description: Authenticate user and receive tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 */
router.post('/login',
    loginSchema,
    validate,
    authController.login
);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password
 *     description: Reset password using a temporary token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 format: password
 */
router.post('/reset-password',
    resetPasswordSchema,
    validate,
    authController.resetPassword
);

module.exports = router;
