const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { authorize, requireSuperAdmin } = require('../middleware/rbac');
const asyncHandler = require('../utils/asyncHandler');
const tenantController = require('../controllers/tenantController');

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Tenant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - name
 */

/**
 * @openapi
 * /api/tenants:
 *   get:
 *     tags:
 *       - Tenants
 *     summary: List tenants
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
// GET /api/tenants - List all tenants (SUPER_ADMIN ONLY)
router.get('/', authenticateToken, requireSuperAdmin, authorize('tenant_management', 'read'), asyncHandler(tenantController.listTenants));

/**
 * POST /api/tenants - create tenant (SUPER_ADMIN ONLY)
 */
router.post('/',
	authenticateToken,
	requireSuperAdmin,
	authorize('tenant_management', 'create'),
	[ body('name').isLength({ min: 1 }).withMessage('name is required') ],
	asyncHandler(async (req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
		return tenantController.createTenant(req, res, next);
	})
);

/**
 * @openapi
 * /api/tenants:
 *   post:
 *     tags:
 *       - Tenants
 *     summary: Create a tenant
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Tenant'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

// GET /api/tenants/:id - Get tenant by id (SUPER_ADMIN ONLY)
router.get('/:id', authenticateToken, requireSuperAdmin, authorize('tenant_management', 'read'), asyncHandler(tenantController.getTenantById));
/**
 * @openapi
 * /api/tenants/{id}:
 *   get:
 *     tags:
 *       - Tenants
 *     summary: Get tenant by id
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
 *         description: Not Found
 */
// PUT /api/tenants/:id - update tenant (SUPER_ADMIN ONLY)
router.put('/:id', authenticateToken, requireSuperAdmin, authorize('tenant_management', 'update'), asyncHandler(tenantController.updateTenant));
/**
 * @openapi
 * /api/tenants/{id}:
 *   put:
 *     tags:
 *       - Tenants
 *     summary: Update tenant
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
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found
 */
// DELETE /api/tenants/:id - delete tenant (SUPER_ADMIN ONLY)
router.delete('/:id', authenticateToken, requireSuperAdmin, authorize('tenant_management', 'delete'), asyncHandler(tenantController.deleteTenant));
/**
 * @openapi
 * /api/tenants/{id}:
 *   delete:
 *     tags:
 *       - Tenants
 *     summary: Delete tenant
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found
 */

module.exports = router;
