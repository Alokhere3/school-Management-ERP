const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { upload } = require('../config/s3');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const staffController = require('../controllers/staffController');
const multer = require('multer');

const router = express.Router();

// Configure multer for multiple file fields
// For staff: photo, resume, joiningLetter
const staffUpload = upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'joiningLetter', maxCount: 1 }
]);

/**
 * @openapi
 * /api/staff:
 *   get:
 *     tags:
 *       - Staff
 *     summary: List staff members
 *     description: List all staff members with pagination and filtering. Requires hr_payroll:read permission.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: designation
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

// GET /api/staff - List all staff
router.get('/', 
    authenticateToken, 
    authorize('hr_payroll', 'read'), 
    asyncHandler(staffController.listStaff)
);

/**
 * @openapi
 * /api/staff:
 *   post:
 *     tags:
 *       - Staff
 *     summary: Create staff member
 *     description: Create a new staff member with optional file uploads (photo, resume, joining letter). Requires hr_payroll:create permission.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               department:
 *                 type: string
 *               designation:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *               resume:
 *                 type: string
 *                 format: binary
 *               joiningLetter:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

// POST /api/staff - Create staff with files
router.post('/',
    authenticateToken,
    authorize('hr_payroll', 'create'),
    require('../middleware/validation'), // Input sanitization
    staffUpload,
    [
        body('firstName').isLength({ min: 1 }).withMessage('firstName is required'),
        body('lastName').isLength({ min: 1 }).withMessage('lastName is required'),
        body('email').optional().isEmail().withMessage('email must be valid'),
        body('dateOfJoining').optional().isISO8601().withMessage('dateOfJoining must be a valid date')
    ],
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }
        return staffController.createStaff(req, res, next);
    })
);

/**
 * @openapi
 * /api/staff/{id}:
 *   get:
 *     tags:
 *       - Staff
 *     summary: Get staff by id
 *     description: Get detailed information about a specific staff member. Requires hr_payroll:read permission.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   put:
 *     tags:
 *       - Staff
 *     summary: Update staff
 *     description: Update an existing staff member. All fields are optional. Requires hr_payroll:update permission.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Not Found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   delete:
 *     tags:
 *       - Staff
 *     summary: Delete staff (soft delete)
 *     description: Soft delete a staff member (sets status to inactive). Requires hr_payroll:delete permission.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
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
 *         description: Not Found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

// GET /api/staff/:id - Get single staff
router.get('/:id', 
    authenticateToken, 
    authorize('hr_payroll', 'read'), 
    asyncHandler(staffController.getStaffById)
);

// PUT /api/staff/:id - Update staff
router.put('/:id', 
    authenticateToken, 
    authorize('hr_payroll', 'update'), 
    require('../middleware/validation'),
    staffUpload,
    asyncHandler(staffController.updateStaff)
);

// DELETE /api/staff/:id - Delete staff (soft delete)
router.delete('/:id', 
    authenticateToken, 
    authorize('hr_payroll', 'delete'), 
    asyncHandler(staffController.deleteStaff)
);

module.exports = router;

