/**
 * ClassRepository
 * 
 * Extends BaseRepository with class-specific RLS rules.
 * CRITICAL: All class data access MUST flow through this repository.
 * 
 * RLS Rules:
 * - Admin: See all classes in their tenant
 * - Teacher: See classes they teach
 * - Student: See their own class
 */

const BaseRepository = require('./BaseRepository');
const { Op } = require('sequelize');

class ClassRepository extends BaseRepository {
    /**
     * CRITICAL: Apply class-specific RLS filters
     * 
     * @param {Object} where - Existing WHERE clause
     * @param {Object} userContext - Validated user context
     * @param {String} action - 'read', 'update', 'delete'
     * @returns {Object} WHERE clause with class RLS filters
     */
    applyRLSFilters(where, userContext, action = 'read') {
        const baseWhere = { ...where, ...this.buildTenantFilter(userContext) };
        const { role, userId } = userContext;

        switch (role.toLowerCase()) {
            case 'admin':
            case 'super_admin':
            case 'superadmin':
                return baseWhere;

            case 'teacher':
                // Teachers see only classes they teach
                if (action !== 'read') {
                    baseWhere.teacherId = userId;
                }
                return baseWhere;

            case 'student':
                // Students see only their own class
                baseWhere.studentId = userId;
                return baseWhere;

            default:
                // Unknown role - apply strictest filtering
                baseWhere.userId = userId;
                return baseWhere;
        }
    }

    /**
     * Find visible classes with RLS enforcement
     * 
     * @param {Object} userContext - User context
     * @param {Object} filters - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Object>} { count, rows }
     */
    async findVisibleClasses(userContext, filters = {}, options = {}) {
        return this.findAndCountWithRLS(userContext, filters, options);
    }

    /**
     * Find class by ID with RLS enforcement
     * 
     * @param {String} id - Class ID
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} Class or null
     */
    async findClassById(id, userContext, options = {}) {
        return this.findByIdWithRLS(id, userContext, options);
    }

    /**
     * Create class with RLS enforcement
     * 
     * @param {Object} classData - Class fields
     * @param {Object} userContext - User context
     * @returns {Promise<Object>} Created class
     */
    async createClass(classData, userContext) {
        const context = this.validateUserContext(userContext);
        
        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can create classes');
        }

        return this.createWithRLS(classData, userContext);
    }

    /**
     * Update class with RLS enforcement
     * 
     * @param {String} classId - Class ID
     * @param {Object} updateData - Fields to update
     * @param {Object} userContext - User context
     * @returns {Promise<Array>} [rowsUpdated, updatedRecords]
     */
    async updateClass(classId, updateData, userContext) {
        const context = this.validateUserContext(userContext);
        
        const class_ = await this.findClassById(classId, userContext);
        if (!class_) {
            throw new Error('NOT_FOUND: Class not found or access denied');
        }

        return this.updateWithRLS(classId, updateData, userContext);
    }

    /**
     * Delete class with RLS enforcement
     * 
     * @param {String} classId - Class ID
     * @param {Object} userContext - User context
     * @returns {Promise<Number>} Rows deleted
     */
    async deleteClass(classId, userContext) {
        const context = this.validateUserContext(userContext);
        
        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can delete classes');
        }

        return this.deleteWithRLS(classId, userContext);
    }

    /**
     * Find classes by teacher with RLS enforcement
     * 
     * @param {String} teacherId - Teacher ID
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Classes taught by teacher
     */
    async findClassesByTeacher(teacherId, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        
        if (context.userId !== teacherId && !this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Cannot view other teachers\' classes');
        }

        return this.findVisibleClasses(userContext, { teacherId }, options);
    }

    /**
     * Find class by session with RLS enforcement
     * 
     * @param {String} session - Session name
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Classes in session
     */
    async findClassesBySession(session, userContext, options = {}) {
        return this.findVisibleClasses(userContext, { session }, options);
    }

    /**
     * Count visible classes
     * 
     * @param {Object} userContext - User context
     * @param {Object} filters - Additional filters
     * @returns {Promise<Number>} Count of visible classes
     */
    async countVisibleClasses(userContext, filters = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('count', context, `filters=${JSON.stringify(filters)}`);

        const where = this.applyRLSFilters(filters, context, 'read');
        return this.model.count({ where });
    }
}

module.exports = ClassRepository;
