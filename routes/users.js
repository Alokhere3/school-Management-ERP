const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const asyncHandler = require('../utils/asyncHandler');
const userController = require('../controllers/userController');

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     UserRole:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         isSystemRole:
 *           type: boolean
 *         roleId:
 *           type: string
 *           format: uuid
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         roles:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserRole'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: List all users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email
 *       - in: query
 *         name: roleId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by role ID
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get current logged-in user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 */
router.get('/profile', authenticateToken, asyncHandler(userController.getProfile));

router.get('/', authenticateToken, authorize('user_management', 'read'), asyncHandler(userController.listUsers));

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 */
router.get('/:id', authenticateToken, authorize('user_management', 'read'), asyncHandler(userController.getUserById));

/**
 * @openapi
 * /api/users/{id}/roles:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update user roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/:id/roles', authenticateToken, authorize('user_management', 'update'), asyncHandler(userController.updateUserRoles));

// Existing profile route (moved from userController)
// Note: This matches /api/profile if mounted there, but if we mount at /api/users, it becomes /api/users/profile
// Wait, the client probably expects /api/profile. 
// I should keep `getProfile` separate or allow it here?
// The previous code had `getProfile` export but where was it used?
// I haven't seen `routes/user.js` or `routes/profile.js`.
// Let's check server.js again to see where `getProfile` was mounted.
// Ah, checking server.js... I don't see `/api/profile` mounted explicitly.
// Wait, I missed it?
// Lines 164-200 don't show `/api/profile`.
// Maybe it was inside `authRoutes`?

// Let's check `routes/auth.js` again. It only had register/login.
// Maybe it was `routes/users.js` that I missed?
// List dir showed `userController.js` but no `userRoutes.js`.
// List dir showed `staff`, `student` etc.

// Maybe `getProfile` was NOT mounted? Or maybe I missed it in `server.js` or `routes/auth.js`.
// Let's check `routes/auth.js` again. 
// It exports router.
// It uses `authController`.

// Where is `getProfile` used?
// `userController.js` exported `getProfile`.
// If I grep for `getProfile` in `routes`...
// If it's not used, I should probably expose it at `/api/users/profile` OR `/api/profile`.

module.exports = router;
