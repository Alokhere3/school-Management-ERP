/**
 * Example: RBAC-Protected Student Routes
 * 
 * This shows how to apply the RBAC authorization middleware
 * to real API endpoints.
 * 
 * Usage:
 * - GET /api/students - List students (read permission required)
 * - POST /api/students - Create student (create permission required)
 * - PUT /api/students/:id - Update student (update permission required)
 * - DELETE /api/students/:id - Delete student (delete permission required)
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize, checkPermission } = require('../middleware/rbac');
const studentController = require('../controllers/studentController');

/**
 * GET /api/students
 * List students - requires read permission
 * Teachers see only their students (limited)
 * Admins see all (full)
 */
router.get(
    '/',
    authenticate,
    authorize('students', 'read'),
    studentController.listStudents
);

/**
 * GET /api/students/:id
 * Get single student - requires read permission
 */
router.get(
    '/:id',
    authenticate,
    authorize('students', 'read'),
    studentController.getStudentById
);

/**
 * POST /api/students
 * Create student - requires create permission (full access)
 */
router.post(
    '/',
    authenticate,
    authorize('students', 'create'),
    studentController.createStudent
);

/**
 * PUT /api/students/:id
 * Update student - requires update permission (full access)
 */
router.put(
    '/:id',
    authenticate,
    authorize('students', 'update'),
    studentController.updateStudent
);

/**
 * DELETE /api/students/:id
 * Delete student - requires delete permission (full access)
 */
router.delete(
    '/:id',
    authenticate,
    authorize('students', 'delete'),
    studentController.deleteStudent
);

/**
 * GET /api/students/export/csv
 * Export students to CSV - requires export permission (full access)
 */
router.get(
    '/export/csv',
    authenticate,
    authorize('students', 'export'),
    async (req, res) => {
        // Implementation would generate CSV
        res.json({ message: 'Export student data as CSV' });
    }
);

module.exports = router;
