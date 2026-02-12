const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac'); // Switched to RBAC
const { upload } = require('../config/s3');
const { body, validationResult, query, param } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const teacherController = require('../controllers/teacherController');
const { sendError } = require('../utils/errorMapper');

const router = express.Router();

// ... (Validations remain unchanged) ...
/**
 * Validation middleware for teacher creation
 */
const validateCreateTeacher = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('firstName is required')
        .isLength({ min: 1, max: 100 }).withMessage('firstName must be between 1 and 100 characters'),

    body('lastName')
        .trim()
        .notEmpty().withMessage('lastName is required')
        .isLength({ min: 1, max: 100 }).withMessage('lastName must be between 1 and 100 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('email is required')
        .isEmail().withMessage('email must be a valid email address'),

    body('password')
        .notEmpty().withMessage('password is required')
        .isLength({ min: 8 }).withMessage('password must be at least 8 characters long'),

    body('teacherId')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('teacherId must be between 1 and 100 characters'),

    body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^[0-9]{10,15}$/).withMessage('phone must be 10-15 digits'),

    body('gender')
        .optional()
        .isIn(['Male', 'Female', 'Other']).withMessage('gender must be Male, Female, or Other'),

    body('bloodGroup')
        .optional()
        .isLength({ min: 1, max: 10 }).withMessage('bloodGroup must be between 1 and 10 characters'),

    body('maritalStatus')
        .optional()
        .isIn(['Single', 'Married', 'Divorced', 'Widowed']).withMessage('maritalStatus must be Single, Married, Divorced, or Widowed'),

    body('contractType')
        .optional()
        .isIn(['Permanent', 'Temporary', 'Contract', 'Probation']).withMessage('contractType must be valid'),

    body('workShift')
        .optional()
        .isIn(['Morning', 'Afternoon', 'Night']).withMessage('workShift must be Morning, Afternoon, or Night'),

    body('basicSalary')
        .optional()
        .isDecimal().withMessage('basicSalary must be a valid decimal number'),

    body('medicalLeaves')
        .optional()
        .isInt({ min: 0 }).withMessage('medicalLeaves must be a non-negative integer'),

    body('casualLeaves')
        .optional()
        .isInt({ min: 0 }).withMessage('casualLeaves must be a non-negative integer'),

    body('maternityLeaves')
        .optional()
        .isInt({ min: 0 }).withMessage('maternityLeaves must be a non-negative integer'),

    body('sickLeaves')
        .optional()
        .isInt({ min: 0 }).withMessage('sickLeaves must be a non-negative integer'),

    body('status')
        .optional()
        .isIn(['active', 'inactive', 'on-leave', 'suspended', 'resigned']).withMessage('status must be valid'),

    body('facebookUrl')
        .optional()
        .isURL().withMessage('facebookUrl must be a valid URL'),

    body('instagramUrl')
        .optional()
        .isURL().withMessage('instagramUrl must be a valid URL'),

    body('linkedinUrl')
        .optional()
        .isURL().withMessage('linkedinUrl must be a valid URL'),

    body('youtubeUrl')
        .optional()
        .isURL().withMessage('youtubeUrl must be a valid URL'),

    body('twitterUrl')
        .optional()
        .isURL().withMessage('twitterUrl must be a valid URL')
];

/**
 * Validation middleware for teacher update
 */
const validateUpdateTeacher = [
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('firstName must be between 1 and 100 characters'),

    body('lastName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('lastName must be between 1 and 100 characters'),

    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('email must be a valid email address'),

    body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^[0-9]{10,15}$/).withMessage('phone must be 10-15 digits'),

    body('gender')
        .optional()
        .isIn(['Male', 'Female', 'Other']).withMessage('gender must be Male, Female, or Other'),

    body('bloodGroup')
        .optional()
        .isLength({ min: 1, max: 10 }).withMessage('bloodGroup must be between 1 and 10 characters'),

    body('maritalStatus')
        .optional()
        .isIn(['Single', 'Married', 'Divorced', 'Widowed']).withMessage('maritalStatus must be valid'),

    body('contractType')
        .optional()
        .isIn(['Permanent', 'Temporary', 'Contract', 'Probation']).withMessage('contractType must be valid'),

    body('workShift')
        .optional()
        .isIn(['Morning', 'Afternoon', 'Night']).withMessage('workShift must be valid'),

    body('basicSalary')
        .optional()
        .isDecimal().withMessage('basicSalary must be a valid decimal number'),

    body('status')
        .optional()
        .isIn(['active', 'inactive', 'on-leave', 'suspended', 'resigned']).withMessage('status must be valid'),

    body('facebookUrl')
        .optional()
        .isURL().withMessage('facebookUrl must be a valid URL'),

    body('instagramUrl')
        .optional()
        .isURL().withMessage('instagramUrl must be a valid URL'),

    body('linkedinUrl')
        .optional()
        .isURL().withMessage('linkedinUrl must be a valid URL'),

    body('youtubeUrl')
        .optional()
        .isURL().withMessage('youtubeUrl must be a valid URL'),

    body('twitterUrl')
        .optional()
        .isURL().withMessage('twitterUrl must be a valid URL')
];

/**
 * Validation error handler middleware
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const logger = require('../config/logger');
        logger.error(`[handleValidationErrors] Errors detected:`, errors.array());
        logger.error(`[handleValidationErrors] req.body at validation:`, Object.keys(req.body));
        return sendError(res, {
            status: 400,
            body: {
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors.array().map(err => ({
                    field: err.param,
                    message: err.msg
                }))
            }
        });
    }
    next();
};

/**
 * ============================================
 * ROUTES
 * ============================================
 */

/**
 * @openapi
 * /api/teachers:
 *   post:
 *     tags:
 *       - Teachers
 *     summary: Create a new teacher
 *     description: Create a new teacher with profile image, resume, and joining letter uploads. teacherId is optional and will be auto-generated per tenant starting from 1 if not provided.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@school.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePass123!"
 *               teacherId:
 *                 type: string
 *                 example: "T001"
 *                 description: "Optional. If not provided, will be auto-generated starting from 1 per school/tenant"
 *               phone:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               contractType:
 *                 type: string
 *                 enum: [Permanent, Temporary, Contract, Probation]
 *               qualification:
 *                 type: string
 *               workExperience:
 *                 type: string
 *               dateOfJoining:
 *                 type: string
 *                 format: date
 *               classIds:
 *                 type: string
 *                 description: "JSON array of class IDs"
 *                 example: '["uuid1", "uuid2"]'
 *               subjectIds:
 *                 type: string
 *                 description: "JSON array of subject IDs"
 *                 example: '["uuid1", "uuid2"]'
 *               basicSalary:
 *                 type: number
 *                 format: decimal
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: "JPG/PNG/SVG, max 4MB"
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: "PDF, max 4MB"
 *               joiningLetter:
 *                 type: string
 *                 format: binary
 *                 description: "PDF, max 4MB"
 *     responses:
 *       201:
 *         description: Teacher created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 teacher:
 *                   $ref: '#/components/schemas/Teacher'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate email
 */
router.post('/',
    authenticateToken,
    authorize('teacher', 'create'),
    upload.fields([
        { name: 'profileImage', maxCount: 1 },
        { name: 'resume', maxCount: 1 },
        { name: 'joiningLetter', maxCount: 1 }
    ]),
    validateCreateTeacher,
    handleValidationErrors,
    teacherController.createTeacher
);

/**
 * @openapi
 * /api/teachers:
 *   get:
 *     tags:
 *       - Teachers
 *     summary: List teachers
 *     description: List all teachers visible to the user with RLS enforcement
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, on-leave, suspended, resigned]
 *       - in: query
 *         name: contractType
 *         schema:
 *           type: string
 *           enum: [Permanent, Temporary, Contract, Probation]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by firstName, lastName, email, or teacherId
 *     responses:
 *       200:
 *         description: Teachers listed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     rows:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Teacher'
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/',
    authenticateToken,
    authorize('teacher', 'read'),
    teacherController.listTeachers
);

/**
 * @openapi
 * /api/teachers/{id}:
 *   get:
 *     tags:
 *       - Teachers
 *     summary: Get teacher by ID
 *     description: Fetch a single teacher by ID with RLS enforcement
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
 *         description: Teacher fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 teacher:
 *                   $ref: '#/components/schemas/Teacher'
 *       404:
 *         description: Teacher not found
 */
router.get('/:id',
    authenticateToken,
    authorize('teacher', 'read'),
    param('id').isUUID().withMessage('id must be a valid UUID'),
    handleValidationErrors,
    teacherController.getTeacherById
);

// Generate presigned upload URL for teacher files
router.post('/:id/presign',
    authenticateToken,
    authorize('teacher', 'update'),
    asyncHandler(async (req, res, next) => {
        // Delegate to controller
        return teacherController.presignTeacherUpload(req, res, next);
    })
);

/**
 * @openapi
 * /api/teachers/{id}:
 *   put:
 *     tags:
 *       - Teachers
 *     summary: Update teacher
 *     description: Update teacher record with partial updates and file replacements
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
 *                 format: email
 *               phone:
 *                 type: string
 *               gender:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               contractType:
 *                 type: string
 *               status:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 format: binary
 *               resume:
 *                 type: string
 *                 format: binary
 *               joiningLetter:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Teacher updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 teacher:
 *                   $ref: '#/components/schemas/Teacher'
 *       404:
 *         description: Teacher not found
 *       409:
 *         description: Duplicate email
 */
router.put('/:id',
    authenticateToken,
    authorize('teacher', 'update'),
    upload.fields([
        { name: 'profileImage', maxCount: 1 },
        { name: 'resume', maxCount: 1 },
        { name: 'joiningLetter', maxCount: 1 }
    ]),
    param('id').isUUID().withMessage('id must be a valid UUID'),
    validateUpdateTeacher,
    handleValidationErrors,
    teacherController.updateTeacher
);

/**
 * @openapi
 * /api/teachers/{id}:
 *   delete:
 *     tags:
 *       - Teachers
 *     summary: Delete teacher
 *     description: Soft delete a teacher (and linked user account)
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
 *         description: Teacher deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Teacher not found
 */
router.delete('/:id',
    authenticateToken,
    authorize('teacher', 'delete'),
    param('id').isUUID().withMessage('id must be a valid UUID'),
    handleValidationErrors,
    teacherController.deleteTeacher
);

module.exports = router;
