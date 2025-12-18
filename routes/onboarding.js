const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { enforceTenantScope } = require('../middleware/auth');
const onboardingController = require('../controllers/onboardingController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * /api/v1/tenants/{tenantId}/staff:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Create staff member with optional portal access
 *     description: Creates a staff member and optionally creates a User account with temporary password for portal access.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
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
 *             required:
 *               - firstName
 *               - lastName
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               designation:
 *                 type: string
 *               department:
 *                 type: string
 *               employeeType:
 *                 type: string
 *               enablePortalAccess:
 *                 type: boolean
 *                 description: If true, creates User account with temporary password
 *               role:
 *                 type: string
 *                 enum: [TEACHER, STAFF, ACCOUNTANT, LIBRARIAN, ADMIN]
 *                 description: Role to assign if portal access is enabled
 *     responses:
 *       201:
 *         description: Staff created successfully
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
 *                     staff:
 *                       $ref: '#/components/schemas/Staff'
 *                     credentials:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         email:
 *                           type: string
 *                         tempPassword:
 *                           type: string
 *                         mustChangePassword:
 *                           type: boolean
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Email already exists
 */
router.post('/staff',
    authenticateToken,
    enforceTenantScope,
    authorize('hr_payroll', 'create'),
    asyncHandler(onboardingController.createStaffWithUser)
);

/**
 * @openapi
 * /api/v1/tenants/{tenantId}/admissions/create-with-users:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Create student with parents and optional user accounts
 *     description: Creates a student record, parent records, and optionally creates User accounts for student and parents with temporary passwords.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
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
 *             required:
 *               - student
 *             properties:
 *               student:
 *                 type: object
 *                 description: Student data (all Student model fields)
 *               createStudentUser:
 *                 type: boolean
 *                 description: If true, creates User account for student
 *               parents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     relation:
 *                       type: string
 *                       enum: [Father, Mother, Guardian, Grandparent, Other]
 *                     createUser:
 *                       type: boolean
 *                     isPrimary:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Student and parents created successfully
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
 *                     student:
 *                       $ref: '#/components/schemas/Student'
 *                     credentials:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [STUDENT, PARENT]
 *                           email:
 *                             type: string
 *                           tempPassword:
 *                             type: string
 *                           method:
 *                             type: string
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/admissions/create-with-users',
    authenticateToken,
    enforceTenantScope,
    authorize('students', 'create'),
    asyncHandler(onboardingController.createStudentWithParents)
);

module.exports = router;


