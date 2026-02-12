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
// const PermissionScope = require('../models/PermissionScope'); // Removed
const { Op } = require('sequelize');

class StudentRepository extends BaseRepository {
    constructor(model) {
        super(model, 'students');
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

        // Admin Skip: Admins see everything, so Owned filter shouldn't restrict them 
        // (But typically appliesFiltered is called with scope='owned' only if scope resolution said so)
        // However, if we are here, we should check if user is admin to avoid filtering by userId
        const lowerRole = role.toLowerCase();
        if (['admin', 'super_admin', 'school_admin', 'school_admin_global', 'principal'].includes(lowerRole)) {
            return where;
        }

        if (roles.some(r => r.toLowerCase().includes('teacher'))) {
            // Teacher: See students in their classes
            if (action !== 'read') {
                where.teacherId = userId;
            }
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
     * @param {Object} transaction - Optional Sequelize transaction for atomicity
     * @returns {Promise<Object>} Created student
     */
    async createStudent(studentData, userContext, transaction = null) {
        const context = this.validateUserContext(userContext);
        console.log(`\n[DEBUG-STUDENT] createStudent called`);
        console.log(`[DEBUG-STUDENT] transaction:`, transaction ? 'PRESENT' : 'MISSING');
        console.log(`[DEBUG-STUDENT] transaction.id:`, transaction ? transaction.id : 'N/A');

        // Validate user can create students
        if (!this.isAdmin(context) && context.role.toLowerCase() !== 'admin') {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can create students');
        }

        // Auto-assign admissionNo if not provided
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                if (!studentData.admissionNo) {
                    // Efficiently find the maximum numeric admissionNo
                    // Pass transaction to ensure we see relevant data if already modified in this txn
                    const allStudents = await this.model.findAll({
                        where: {
                            tenantId: context.tenantId,
                            admissionNo: { [Op.not]: [null, ''] }
                        },
                        attributes: ['admissionNo'],
                        raw: true,
                        transaction // Pass the transaction object
                    });

                    let maxAdmissionNo = 0;
                    if (allStudents.length > 0) {
                        // Determine max manually in JS to handle string-number sorting correctly
                        allStudents.forEach(s => {
                            const num = parseInt(s.admissionNo, 10);
                            if (!isNaN(num) && num > maxAdmissionNo) {
                                maxAdmissionNo = num;
                            }
                        });
                    }

                    // Start from 1
                    // If this is a retry (attempts > 0), increment based on previous failure or re-calculation
                    const nextAdmissionNumber = maxAdmissionNo + 1 + attempts;

                    studentData.admissionNo = String(nextAdmissionNumber);
                    console.log(`[ADMISSION_NO] Auto-assigned admissionNo=${studentData.admissionNo} for tenantId=${context.tenantId}. Max found: ${maxAdmissionNo}. Attempt: ${attempts + 1}`);
                }

                // Auto-assign rollNumber if classId is provided (only do this once or re-calc if needed)
                if (studentData.classId && !studentData.rollNumber) {
                    const maxrollNumber = await this.model.max('rollNumber', {
                        where: {
                            classId: studentData.classId,
                            tenantId: context.tenantId,
                            rollNumber: { [Op.not]: null }
                        },
                        transaction
                    });
                    studentData.rollNumber = (maxrollNumber || 0) + 1;
                    console.log(`[ROLE_NUMBER] Auto-assigned rollNumber=${studentData.rollNumber} for classId=${studentData.classId}`);
                } else if (!studentData.classId) {
                    // If no classId provided, rollNumber should remain null
                    console.log(`[ROLE_NUMBER] No classId provided, rollNumber will be null`);
                }

                // Pass transaction to createWithRLS
                const options = transaction ? { transaction } : {};
                console.log(`[DEBUG-STUDENT] Calling createWithRLS with options:`, { transaction: options.transaction ? 'PRESENT' : 'MISSING' });
                const result = await this.createWithRLS(studentData, userContext, options);
                console.log(`[DEBUG-STUDENT] createWithRLS returned, student ID:`, result.id);
                console.log(`[DEBUG-STUDENT] createStudent completed successfully\n`);
                return result;

            } catch (err) {
                // Check if it's a unique constraint error specifically on admissionNo
                const isUniqueError = err.name === 'SequelizeUniqueConstraintError';
                const isAdmissionError = isUniqueError && err.errors && err.errors.some(e => e.path === 'admissionNo' || e.message.includes('compositeIndex'));

                if (isAdmissionError) {
                    attempts++;
                    console.warn(`[CREATE_RETRY] Duplicate admissionNo detected. Retrying... (Attempt ${attempts}/${maxAttempts})`);
                    // Reset admissionNo to trigger re-calculation in next loop
                    studentData.admissionNo = null;
                    if (attempts >= maxAttempts) throw err;
                } else {
                    throw err;
                }
            }
        }
    }

    /**
     * CRITICAL: Update student with RLS enforcement
     * 
     * @param {String} studentId - Student ID
     * @param {Object} updateData - Fields to update
     * @param {Object} userContext - User context
     * @param {Object} transaction - Optional Sequelize transaction for atomicity
     * @returns {Promise<Array>} [rowsUpdated, updatedRecords]
     */
    async updateStudent(studentId, updateData, userContext, transaction = null) {
        const context = this.validateUserContext(userContext);

        // Check if user can update this student
        // Pass transaction to findStudentById to maintain transaction context
        const findOptions = transaction ? { transaction } : {};
        const student = await this.findStudentById(studentId, userContext, findOptions);
        if (!student) {
            throw new Error('NOT_FOUND: Student not found or access denied');
        }

        // Pass transaction to updateWithRLS if provided
        const options = transaction ? { transaction } : {};
        return this.updateWithRLS(studentId, updateData, userContext, options);
    }

    /**
     * CRITICAL: Delete student with RLS enforcement
     * 
     * @param {String} studentId - Student ID
     * @param {Object} userContext - User context
     * @param {Object} transaction - Optional Sequelize transaction for atomicity
     * @returns {Promise<Number>} Rows deleted
     */
    async deleteStudent(studentId, userContext, transaction = null) {
        const context = this.validateUserContext(userContext);

        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can delete students');
        }

        // Verify student exists before deletion
        // Pass transaction to findStudentById to maintain transaction context
        const findOptions = transaction ? { transaction } : {};
        const student = await this.findStudentById(studentId, userContext, findOptions);
        if (!student) {
            throw new Error('NOT_FOUND: Student not found or access denied');
        }

        // Pass transaction to deleteWithRLS if provided
        const options = transaction ? { transaction } : {};
        return this.deleteWithRLS(studentId, userContext, options);
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

    /**
     * Get student with siblings (single efficient query via join)
     * Called by getStudentById to fetch student + siblings in one query
     * 
     * @param {String} studentId - Student ID
     * @param {Object} userContext - User context
     * @returns {Promise<Object|null>} Student with siblings array or null
     */
    async findStudentWithSiblings(studentId, userContext) {
        const context = this.validateUserContext(userContext);
        const StudentSibling = require('../models/StudentSibling');

        // Fetch student with RLS
        const student = await this.findStudentById(studentId, userContext);
        if (!student) {
            return null;
        }

        // Fetch siblings efficiently via join
        const siblingLinks = await StudentSibling.findAll({
            where: {
                tenantId: context.tenantId,
                studentId: studentId
            },
            attributes: ['siblingStudentId'],
            raw: true
        });

        const siblingIds = siblingLinks.map(link => link.siblingStudentId);
        let siblings = [];

        if (siblingIds.length > 0) {
            // Fetch sibling student records (only active ones)
            siblings = await this.model.findAll({
                where: {
                    id: { [Op.in]: siblingIds },
                    tenantId: context.tenantId,
                    status: 'active'
                },
                attributes: ['id', 'firstName', 'lastName', 'admissionNo', 'photoKey', 'classId', 'classData', 'rollNumber'],
                raw: true,
                order: [['firstName', 'ASC']]
            });
        }

        const studentData = student.toJSON ? student.toJSON() : student;
        studentData.siblings = siblings;
        return studentData;
    }

    /**
     * Delete student and cleanup sibling relationships
     * Overrides parent deleteStudent to handle sibling cleanup
     * 
     * @param {String} studentId - Student ID
     * @param {Object} userContext - User context
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<Number>} Rows deleted
     */
    async deleteStudentWithSiblings(studentId, userContext, transaction) {
        const context = this.validateUserContext(userContext);

        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can delete students');
        }

        // Delete all sibling relationships for this student
        const StudentSiblingRepository = require('./StudentSiblingRepository');
        const StudentSibling = require('../models/StudentSibling');
        const siblingRepo = new StudentSiblingRepository(StudentSibling);

        await siblingRepo.removeSiblingsForStudent(studentId, userContext, transaction);

        // Delete the student record
        return this.deleteWithRLS(studentId, userContext, transaction);
    }
}

module.exports = StudentRepository;
