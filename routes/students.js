
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { upload } = require('../config/s3');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const studentController = require('../controllers/studentController');

const router = express.Router();

/**
 * @openapi
 * /api/students:
 *   get:
 *     tags:
 *       - Students
 *     summary: List students
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

/**
 * @openapi
 * /api/students:
 *   post:
 *     tags:
 *       - Students
 *     summary: Create student with all fields
 *     description: Create a new student with all personal, academic, contact, and family information in a single request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - admissionNo
 *               - firstName
 *               - dateOfBirth
 *             properties:
 *               # Basic Info
 *               admissionNo:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               photo:
 *                 type: string
 *                 format: binary
 *               # Application & Academic
 *               session:
 *                 type: string
 *               admissionClass:
 *                 type: string
 *               stream:
 *                 type: string
 *               admissionType:
 *                 type: string
 *                 enum: [New, Transfer]
 *               previousSchoolName:
 *                 type: string
 *               previousSchoolBoard:
 *                 type: string
 *               previousClassAttended:
 *                 type: string
 *               previousResult:
 *                 type: string
 *               # Personal Details
 *               studentName:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *               placeOfBirth:
 *                 type: string
 *               motherTongue:
 *                 type: string
 *               nationality:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [General, OBC, SC, ST, Other]
 *               religion:
 *                 type: string
 *               aadharNumber:
 *                 type: string
 *               # Contact & Address
 *               currentAddressLine1:
 *                 type: string
 *               currentAddressLine2:
 *                 type: string
 *               currentCity:
 *                 type: string
 *               currentDistrict:
 *                 type: string
 *               currentState:
 *                 type: string
 *               currentPIN:
 *                 type: string
 *               permanentAddressLine1:
 *                 type: string
 *               permanentAddressLine2:
 *                 type: string
 *               permanentCity:
 *                 type: string
 *               permanentDistrict:
 *                 type: string
 *               permanentState:
 *                 type: string
 *               permanentPIN:
 *                 type: string
 *               studentMobile:
 *                 type: string
 *               studentEmail:
 *                 type: string
 *               # Family & Guardian
 *               fatherName:
 *                 type: string
 *               fatherPhone:
 *                 type: string
 *               fatherOccupation:
 *                 type: string
 *               fatherEmail:
 *                 type: string
 *               motherName:
 *                 type: string
 *               motherPhone:
 *                 type: string
 *               motherOccupation:
 *                 type: string
 *               motherEmail:
 *                 type: string
 *               guardianName:
 *                 type: string
 *               guardianPhone:
 *                 type: string
 *               guardianRelation:
 *                 type: string
 *               emergencyContact:
 *                 type: string
 *               emergencyContactPhone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Student created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 */


// GET /api/students - List all students
router.get('/', authenticateToken, authorize('students', 'read'), asyncHandler(studentController.listStudents));

// POST /api/students - Create student with all fields
// When accepting multipart/form-data, run multer first so fields are populated on req.body
router.post('/',
    authenticateToken,
    authorize('students', 'create'),
    require('../middleware/validation'), // Input sanitization
    upload.single('photo'),
    [
        body('admissionNo').isLength({ min: 1 }).withMessage('admissionNo is required'),
        body('firstName').isLength({ min: 1 }).withMessage('firstName is required'),
        body('dateOfBirth').optional().isISO8601().withMessage('dateOfBirth must be a valid date'),
        body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('gender must be Male, Female, or Other'),
        body('admissionType').optional().isIn(['New', 'Transfer']).withMessage('admissionType must be New or Transfer'),
        body('category').optional().isIn(['General', 'OBC', 'SC', 'ST', 'Other']).withMessage('category must be General, OBC, SC, ST, or Other'),
        body('studentEmail').optional().isEmail().withMessage('studentEmail must be a valid email'),
        body('fatherEmail').optional().isEmail().withMessage('fatherEmail must be a valid email'),
        body('motherEmail').optional().isEmail().withMessage('motherEmail must be a valid email')
    ],
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
        return studentController.createStudent(req, res, next);
    })
);

/**
 * @openapi
 * /api/students/{id}:
 *   get:
 *     tags:
 *       - Students
 *     summary: Get student by id with all fields
 *     description: Returns complete student information including personal, academic, contact, address, and family details
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
 *         description: Student retrieved successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     admissionNo:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                     photoUrl:
 *                       type: string
 *                     # All other student fields are included
 *                     contacts:
 *                       type: array
 *                       description: Array of contact information (Father, Mother, Guardian, Emergency, Student)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Student not found
 *   put:
 *     tags:
 *       - Students
 *     summary: Update student with all fields
 *     description: Update student information. All fields are optional - only provided fields will be updated.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               # Basic Info
 *               admissionNo:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               photo:
 *                 type: string
 *                 format: binary
 *               # Application & Academic
 *               session:
 *                 type: string
 *               admissionClass:
 *                 type: string
 *               stream:
 *                 type: string
 *               admissionType:
 *                 type: string
 *                 enum: [New, Transfer]
 *               previousSchoolName:
 *                 type: string
 *               previousSchoolBoard:
 *                 type: string
 *               previousClassAttended:
 *                 type: string
 *               previousResult:
 *                 type: string
 *               # Personal Details
 *               studentName:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *               placeOfBirth:
 *                 type: string
 *               motherTongue:
 *                 type: string
 *               nationality:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [General, OBC, SC, ST, Other]
 *               religion:
 *                 type: string
 *               aadharNumber:
 *                 type: string
 *               # Contact & Address
 *               currentAddressLine1:
 *                 type: string
 *               currentAddressLine2:
 *                 type: string
 *               currentCity:
 *                 type: string
 *               currentDistrict:
 *                 type: string
 *               currentState:
 *                 type: string
 *               currentPIN:
 *                 type: string
 *               permanentAddressLine1:
 *                 type: string
 *               permanentAddressLine2:
 *                 type: string
 *               permanentCity:
 *                 type: string
 *               permanentDistrict:
 *                 type: string
 *               permanentState:
 *                 type: string
 *               permanentPIN:
 *                 type: string
 *               studentMobile:
 *                 type: string
 *               studentEmail:
 *                 type: string
 *               # Family & Guardian
 *               fatherName:
 *                 type: string
 *               fatherPhone:
 *                 type: string
 *               fatherOccupation:
 *                 type: string
 *               fatherEmail:
 *                 type: string
 *               motherName:
 *                 type: string
 *               motherPhone:
 *                 type: string
 *               motherOccupation:
 *                 type: string
 *               motherEmail:
 *                 type: string
 *               guardianName:
 *                 type: string
 *               guardianPhone:
 *                 type: string
 *               guardianRelation:
 *                 type: string
 *               emergencyContact:
 *                 type: string
 *               emergencyContactPhone:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not Found
 *   delete:
 *     tags:
 *       - Students
 *     summary: Delete student
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
 *         description: Not Found
 */
// PUT /api/students/:id - Update student with all fields
router.put('/:id', 
    authenticateToken, 
    authorize('students', 'update'), 
    require('../middleware/validation'), 
    upload.single('photo'),
    [
        body('dateOfBirth').optional().isISO8601().withMessage('dateOfBirth must be a valid date'),
        body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('gender must be Male, Female, or Other'),
        body('admissionType').optional().isIn(['New', 'Transfer']).withMessage('admissionType must be New or Transfer'),
        body('category').optional().isIn(['General', 'OBC', 'SC', 'ST', 'Other']).withMessage('category must be General, OBC, SC, ST, or Other'),
        body('studentEmail').optional().isEmail().withMessage('studentEmail must be a valid email'),
        body('fatherEmail').optional().isEmail().withMessage('fatherEmail must be a valid email'),
        body('motherEmail').optional().isEmail().withMessage('motherEmail must be a valid email'),
        body('status').optional().isIn(['active', 'inactive']).withMessage('status must be active or inactive')
    ],
    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
        return studentController.updateStudent(req, res, next);
    })
);

// GET /api/students/:id - Get single student
router.get('/:id', authenticateToken, authorize('students', 'read'), asyncHandler(studentController.getStudentById));

// DELETE /api/students/:id - Delete student
router.delete('/:id', authenticateToken, authorize('students', 'delete'), asyncHandler(studentController.deleteStudent));

module.exports = router;

