const express = require('express');
const { authenticateToken, requireRole, requireTenantAdmin, blockSuperAdmin } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const asyncHandler = require('../utils/asyncHandler');
const classController = require('../controllers/classController');

const router = express.Router();

/**
 * @openapi
 * /api/classes:
 *   get:
 *     tags:
 *       - Classes
 *     summary: List classes for the tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', authenticateToken, blockSuperAdmin(), authorize('classes', 'read'), asyncHandler(classController.listClasses));

/**
 * @openapi
 * /api/classes:
 *   post:
 *     tags:
 *       - Classes
 *     summary: Create a class (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - className
 *             properties:
 *               className:
 *                 type: string
 *               section:
 *                 type: string
 *               noOfStudents:
 *                 type: integer
 *               noOfSubjects:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', authenticateToken, requireTenantAdmin(), authorize('classes', 'create'), asyncHandler(classController.createClass));

/**
 * @openapi
 * /api/classes/{id}:
 *   get:
 *     tags:
 *       - Classes
 *     summary: Get class by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 */
router.get('/:id', authenticateToken, blockSuperAdmin(), authorize('classes', 'read'), asyncHandler(classController.getClassById));

/**
 * @openapi
 * /api/classes/{id}:
 *   put:
 *     tags:
 *       - Classes
 *     summary: Update class (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               className:
 *                 type: string
 *               section:
 *                 type: string
 *               noOfStudents:
 *                 type: integer
 *               noOfSubjects:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Not found
 */
router.put('/:id', authenticateToken, requireTenantAdmin(), authorize('classes', 'update'), asyncHandler(classController.updateClass));

/**
 * @openapi
 * /api/classes/{id}:
 *   delete:
 *     tags:
 *       - Classes
 *     summary: Delete class (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
router.delete('/:id', authenticateToken, requireTenantAdmin(), authorize('classes', 'delete'), asyncHandler(classController.deleteClass));

module.exports = router;
