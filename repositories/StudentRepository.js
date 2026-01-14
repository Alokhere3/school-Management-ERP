/**
 * StudentRepository
 * 
 * Extends BaseRepository with student-specific RLS rules.
 * CRITICAL: All student data access MUST flow through this repository.
 * 
 * Permission-Scope RLS Rules:
 * - TENANT (Admin): See all students in their tenant
 * - OWNED (Teacher): See students they teach via classId
 * - OWNED (Parent): See only their own children
 * - SELF (Student): See only their own record
 */

const BaseRepository = require('./BaseRepository');
const PermissionScope = require('../models/PermissionScope');
const { Op } = require('sequelize');

class StudentRepository extends BaseRepository {
    constructor(model) {
        super(model, 'student');
    }

    /**
     * CRITICAL: Apply student-specific OWNED scope filtering
     * Overrides base method to implement student-specific logic for OWNED scope
     * 
     * @param {Object} where - WHERE clause with tenantId already included
     * @param {Object} userContext - User context
     * @param {String} action - 'read', 'update', 'delete'
     * @returns {Object} Updated WHERE clause
     */
    applyOwnedFilter(where, userContext, action = 'read') {
        const { role, userId, roles } = userContext;

        // For OWNED scope, determine which type of ownership applies
        if (roles.some(r => r.toLowerCase().includes('teacher'))) {
            // Teacher: See students in their classes
            if (action !== 'read') {
                // For updates/deletes, teacher must be the primary educator
                where.teacherId = userId;
            }
            // For reads, allow viewing all students in their classes
            // (controller may further filter by classId)
            return where;
        }

        if (roles.some(r => r.toLowerCase().includes('parent'))) {
            // Parent: See only their own children
            where.parentOf = userId;
            return where;
        }

        // Default OWNED: User's own records
        where.userId = userId;
        return where;
    }

    /**
     * CRITICAL: Find visible students for user
     * Main method for listing students with full RLS enforcement
     * 
     * Usage:
     *   const { count, rows } = await studentRepo.findVisibleStudents(userContext, filters, options);
     * 
     * @param {Object} userContext - User context (userId, tenantId, role, etc.)
     * @param {Object} filters - Additional filters (classId, search, status, etc.)
     * @param {Object} options - Pagination { page, limit, order, include, attributes }
     * @returns {Promise<Object>} { count, rows }
     */
    async findVisibleStudents(userContext, filters = {}, options = {}) {
        return this.findAndCountWithRLS(userContext, filters, options);
    }

    /**
     * CRITICAL: Find single student by ID with RLS enforcement
     * 
     * @param {String} id - Student ID
     * @param {Object} userContext - User context
     * @param {Object} options - Additional query options
     * @returns {Promise<Object|null>} Student or null
     */
    async findStudentById(id, userContext, options = {}) {
        return this.findByIdWithRLS(id, userContext, options);
    }

    /**
     * CRITICAL: Create student record with RLS enforcement
     * Automatically enforces tenant isolation and assigns rollNumber
     * 
     * @param {Object} studentData - Student fields
     * @param {Object} userContext - User context
     * @returns {Promise<Object>} Created student
     */
    async createStudent(studentData, userContext) {
        const context = this.validateUserContext(userContext);
        
        // Validate user can create students
        if (!this.isAdmin(context) && context.role.toLowerCase() !== 'admin') {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can create students');
        }

        // Auto-assign rollNumber if classId is provided
        if (studentData.classId) {
            const maxrollNumber = await this.model.max('rollNumber', {
                where: {
                    classId: studentData.classId,
                    tenantId: context.tenantId
                }
            });
            
            // Start from 1, or next number after highest existing
            studentData.rollNumber = (maxrollNumber || 0) + 1;
            console.log(`[ROLE_NUMBER] Auto-assigned rollNumber=${studentData.rollNumber} for classId=${studentData.classId}`);
        }

        return this.createWithRLS(studentData, userContext);
    }

    /**
     * CRITICAL: Update student with RLS enforcement
     * 
     * @param {String} studentId - Student ID
     * @param {Object} updateData - Fields to update
     * @param {Object} userContext - User context
     * @returns {Promise<Array>} [rowsUpdated, updatedRecords]
     */
    async updateStudent(studentId, updateData, userContext) {
        const context = this.validateUserContext(userContext);
        
        // Check if user can update this student
        const student = await this.findStudentById(studentId, userContext);
        if (!student) {
            throw new Error('NOT_FOUND: Student not found or access denied');
        }

        return this.updateWithRLS(studentId, updateData, userContext);
    }

    /**
     * CRITICAL: Delete student with RLS enforcement
     * 
     * @param {String} studentId - Student ID
     * @param {Object} userContext - User context
     * @returns {Promise<Number>} Rows deleted
     */
    async deleteStudent(studentId, userContext) {
        const context = this.validateUserContext(userContext);
        
        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can delete students');
        }

        return this.deleteWithRLS(studentId, userContext);
    }

    /**
     * Find students by class with RLS enforcement
     * 
     * @param {String} classId - Class ID
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Students in class
     */
    async findStudentsByClass(classId, userContext, options = {}) {
        return this.findVisibleStudents(userContext, { classId }, options);
    }

    /**
     * Find students by parent with RLS enforcement
     * 
     * @param {String} parentId - Parent user ID
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Students with this parent
     */
    async findStudentsByParent(parentId, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        
        // Only parents or admins can view a parent's students
        if (context.userId !== parentId && !this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Cannot view other users\' children');
        }

        return this.findVisibleStudents(userContext, { parentOf: parentId }, options);
    }

    /**
     * Find students by teacher with RLS enforcement
     * 
     * @param {String} teacherId - Teacher user ID
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Students taught by this teacher
     */
    async findStudentsByTeacher(teacherId, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        
        // Only teachers viewing their own class or admins
        if (context.userId !== teacherId && !this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Cannot view other teachers\' students');
        }

        return this.findVisibleStudents(userContext, { teacherId }, options);
    }

    /**
     * Count visible students
     * 
     * @param {Object} userContext - User context
     * @param {Object} filters - Additional filters
     * @returns {Promise<Number>} Count of visible students
     */
    async countVisibleStudents(userContext, filters = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('count', context, `filters=${JSON.stringify(filters)}`);

        const where = this.applyRLSFilters(filters, context, 'read');
        return this.model.count({ where });
    }

    /**
     * Search students by name with RLS enforcement
     * 
     * @param {String} searchTerm - Search term
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching students
     */
    async searchStudents(searchTerm, userContext, options = {}) {
        const filters = {
            [Op.or]: [
                { firstName: { [Op.iLike]: `%${searchTerm}%` } },
                { lastName: { [Op.iLike]: `%${searchTerm}%` } },
                { admissionNo: { [Op.iLike]: `%${searchTerm}%` } }
            ]
        };

        return this.findVisibleStudents(userContext, filters, options);
    }

    /**
     * Get students needing attention (specific criteria)
     * Useful for dashboards - respects RLS
     * 
     * @param {Object} userContext - User context
     * @param {Array} criteria - Criteria array (e.g., ['inactive', 'low_attendance'])
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Students matching criteria
     */
    async findStudentsByStatus(status, userContext, options = {}) {
        return this.findVisibleStudents(userContext, { status }, options);
    }
}

module.exports = StudentRepository;
