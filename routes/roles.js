const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const asyncHandler = require('../utils/asyncHandler');
const roleController = require('../controllers/roleController');
const rolePermissionController = require('../controllers/rolePermissionController');
const permissionController = require('../controllers/permissionController');

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         tenantId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         isSystemRole:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - name
 *         - isSystemRole
 */

/**
 * @openapi
 * /api/roles:
 *   get:
 *     tags:
 *       - Roles
 *     summary: List all roles
 *     description: Returns both system roles and tenant-specific roles. If tenantId is provided, returns system roles plus roles for that tenant.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or description
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: ASC
 *         description: Sort order
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Optional tenant ID to filter roles
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
 *                     $ref: '#/components/schemas/Role'
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @openapi
 * /api/roles:
 *   post:
 *     tags:
 *       - Roles
 *     summary: Create a new role
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *               isSystemRole:
 *                 type: boolean
 *             required:
 *               - name
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
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Conflict - role name already exists
 */

/**
 * @openapi
 * /api/roles/{id}:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Get role by ID
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
 *                   $ref: '#/components/schemas/Role'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found
 *   put:
 *     tags:
 *       - Roles
 *     summary: Update role
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found
 *       409:
 *         description: Conflict - role name already exists
 *   delete:
 *     tags:
 *       - Roles
 *     summary: Delete role
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
 *       204:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found
 */

/**
 * @openapi
 * /api/roles/{id}/permissions:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Get role permissions
 *     description: Get all permissions for a specific role, grouped by module
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Role not found
 *   put:
 *     tags:
 *       - Roles
 *     summary: Update role permissions (bulk)
 *     description: Update multiple permissions for a role at once
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
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     module:
 *                       type: string
 *                     actions:
 *                       type: object
 *                       additionalProperties:
 *                         type: string
 *                         enum: [none, read, limited, full]
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
 *         description: Role not found
 */

/**
 * @openapi
 * /api/roles/{id}/permissions/{module}:
 *   put:
 *     tags:
 *       - Roles
 *     summary: Update all permissions for a module
 *     description: Update all permissions (create, read, update, delete, export) for a specific module
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: module
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actions:
 *                 type: object
 *                 properties:
 *                   create:
 *                     type: string
 *                     enum: [none, read, limited, full]
 *                   read:
 *                     type: string
 *                     enum: [none, read, limited, full]
 *                   update:
 *                     type: string
 *                     enum: [none, read, limited, full]
 *                   delete:
 *                     type: string
 *                     enum: [none, read, limited, full]
 *                   export:
 *                     type: string
 *                     enum: [none, read, limited, full]
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
 *         description: Role or module not found
 */

/**
 * @openapi
 * /api/roles/{id}/permissions/{module}/allow-all:
 *   put:
 *     tags:
 *       - Roles
 *     summary: Set AllowAll for a module
 *     description: Grant full access to all actions for a specific module (equivalent to checking "AllowAll" checkbox)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: module
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allowAll:
 *                 type: boolean
 *                 description: true to grant full access, false to remove all permissions
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
 *         description: Role or module not found
 */

/**
 * @openapi
 * /api/roles/{id}/permissions/{module}/{action}:
 *   put:
 *     tags:
 *       - Roles
 *     summary: Update a single permission
 *     description: Update a specific permission (module + action) for a role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: module
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [create, read, update, delete, export]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [none, read, limited, full]
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
 *         description: Role, module, or action not found
 */

// GET /api/roles - List all roles (School Admin only)
router.get('/', authenticateToken, authorize('user_management', 'read'), asyncHandler(roleController.listRoles));

// POST /api/roles - Create role (School Admin only)
router.post('/', authenticateToken, authorize('user_management', 'create'), asyncHandler(roleController.createRole));

// GET /api/roles/:id - Get role by id (School Admin only)
router.get('/:id', authenticateToken, authorize('user_management', 'read'), asyncHandler(roleController.getRoleById));

// PUT /api/roles/:id - Update role (School Admin only)
router.put('/:id', authenticateToken, authorize('user_management', 'update'), asyncHandler(roleController.updateRole));

// DELETE /api/roles/:id - Delete role (School Admin only)
router.delete('/:id', authenticateToken, authorize('user_management', 'delete'), asyncHandler(roleController.deleteRole));

// GET /api/roles/:id/permissions - Get role permissions (School Admin only)
router.get('/:id/permissions', authenticateToken, authorize('user_management', 'read'), asyncHandler(rolePermissionController.getRolePermissions));

// PUT /api/roles/:id/permissions - Update role permissions (bulk) (School Admin only)
router.put('/:id/permissions', authenticateToken, authorize('user_management', 'update'), asyncHandler(rolePermissionController.updateRolePermissions));

// PUT /api/roles/:id/permissions/:module/allow-all - Set "AllowAll" for a module (School Admin only) - Must come before /:module route
router.put('/:id/permissions/:module/allow-all', authenticateToken, authorize('user_management', 'update'), asyncHandler(rolePermissionController.setAllowAll));

// PUT /api/roles/:id/permissions/:module/:action - Update a single permission (School Admin only) - Must come before /:module route
router.put('/:id/permissions/:module/:action', authenticateToken, authorize('user_management', 'update'), asyncHandler(rolePermissionController.updateSinglePermission));

// PUT /api/roles/:id/permissions/:module - Update all permissions for a specific module (School Admin only)
router.put('/:id/permissions/:module', authenticateToken, authorize('user_management', 'update'), asyncHandler(rolePermissionController.updateModulePermissions));

module.exports = router;
