/**
 * StaffRepository
 * 
 * Extends BaseRepository with staff-specific RLS rules.
 * CRITICAL: All staff data access MUST flow through this repository.
 * 
 * RLS Rules:
 * - Admin: See all staff in their tenant
 * - HR Manager: See all staff in their tenant
 * - Staff: See only their own record
 */

const BaseRepository = require('./BaseRepository');
const { Op } = require('sequelize');

class StaffRepository extends BaseRepository {
    /**
     * CRITICAL: Apply staff-specific RLS filters
     * 
     * @param {Object} where - Existing WHERE clause
     * @param {Object} userContext - Validated user context
     * @param {String} action - 'read', 'update', 'delete'
     * @returns {Object} WHERE clause with staff RLS filters
     */
    applyRLSFilters(where, userContext, action = 'read') {
        const baseWhere = { ...where, ...this.buildTenantFilter(userContext) };
        const { role, userId } = userContext;

        // Normalize role for matching
        const normalizedRole = (role || '').toLowerCase().replace(/\s+/g, '_');

        switch (normalizedRole) {
            case 'admin':
            case 'super_admin':
            case 'superadmin':
            case 'school_admin':
            case 'principal':
            case 'head_master':
            case 'headmaster':
                // Admins see all staff in their tenant
                return baseWhere;

            case 'hr_manager':
            case 'hr manager':
                // HR managers see all staff in their tenant
                return baseWhere;

            case 'principal':
            case 'head_master':
            case 'headmaster':
                // Principals see all staff
                return baseWhere;

            case 'staff':
            case 'teacher':
                // Staff/Teachers see only their own record
                baseWhere.userId = userId;
                return baseWhere;

            default:
                // Unknown role - apply strictest filtering
                baseWhere.userId = userId;
                return baseWhere;
        }
    }

    /**
     * CRITICAL: Find visible staff for user
     * Main method for listing staff with full RLS enforcement
     * 
     * Usage:
     *   const { count, rows } = await staffRepo.findVisibleStaff(userContext, filters, options);
     * 
     * @param {Object} userContext - User context (userId, tenantId, role, etc.)
     * @param {Object} filters - Additional filters (department, designation, status, etc.)
     * @param {Object} options - Pagination { page, limit, order, include, attributes }
     * @returns {Promise<Object>} { count, rows }
     */
    async findVisibleStaff(userContext, filters = {}, options = {}) {
        return this.findAndCountWithRLS(userContext, filters, options);
    }

    /**
     * CRITICAL: Find single staff member by ID with RLS enforcement
     * 
     * @param {String} id - Staff ID
     * @param {Object} userContext - User context
     * @param {Object} options - Additional query options
     * @returns {Promise<Object|null>} Staff or null
     */
    async findStaffById(id, userContext, options = {}) {
        return this.findByIdWithRLS(id, userContext, options);
    }

    /**
     * CRITICAL: Create staff record with RLS enforcement
     * Automatically enforces tenant isolation
     * 
     * @param {Object} staffData - Staff fields
     * @param {Object} userContext - User context
     * @returns {Promise<Object>} Created staff
     */
    async createStaff(staffData, userContext) {
        const context = this.validateUserContext(userContext);
        
        // Only admins and HR managers can create staff
        const canCreate = this.isAdmin(context) || 
                         context.role.toLowerCase().includes('hr');
        
        if (!canCreate) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins and HR managers can create staff');
        }

        return this.createWithRLS(staffData, userContext);
    }

    /**
     * CRITICAL: Update staff with RLS enforcement
     * 
     * @param {String} staffId - Staff ID
     * @param {Object} updateData - Fields to update
     * @param {Object} userContext - User context
     * @returns {Promise<Array>} [rowsUpdated, updatedRecords]
     */
    async updateStaff(staffId, updateData, userContext) {
        const context = this.validateUserContext(userContext);
        
        // Check if user can update this staff member
        const staff = await this.findStaffById(staffId, userContext);
        if (!staff) {
            throw new Error('NOT_FOUND: Staff member not found or access denied');
        }

        return this.updateWithRLS(staffId, updateData, userContext);
    }

    /**
     * CRITICAL: Delete staff with RLS enforcement
     * 
     * @param {String} staffId - Staff ID
     * @param {Object} userContext - User context
     * @returns {Promise<Number>} Rows deleted
     */
    async deleteStaff(staffId, userContext) {
        const context = this.validateUserContext(userContext);
        
        const canDelete = this.isAdmin(context) || 
                         context.role.toLowerCase().includes('hr');
        
        if (!canDelete) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins and HR managers can delete staff');
        }

        return this.deleteWithRLS(staffId, userContext);
    }

    /**
     * Find staff by department with RLS enforcement
     * 
     * @param {String} department - Department name
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Staff in department
     */
    async findStaffByDepartment(department, userContext, options = {}) {
        return this.findVisibleStaff(userContext, { department }, options);
    }

    /**
     * Find staff by designation with RLS enforcement
     * 
     * @param {String} designation - Designation name
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Staff with designation
     */
    async findStaffByDesignation(designation, userContext, options = {}) {
        return this.findVisibleStaff(userContext, { designation }, options);
    }

    /**
     * Find teachers with RLS enforcement
     * 
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} All teachers in tenant
     */
    async findTeachers(userContext, options = {}) {
        return this.findVisibleStaff(userContext, { designation: 'Teacher' }, options);
    }

    /**
     * Count visible staff
     * 
     * @param {Object} userContext - User context
     * @param {Object} filters - Additional filters
     * @returns {Promise<Number>} Count of visible staff
     */
    async countVisibleStaff(userContext, filters = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('count', context, `filters=${JSON.stringify(filters)}`);

        const where = this.applyRLSFilters(filters, context, 'read');
        return this.model.count({ where });
    }

    /**
     * Search staff by name with RLS enforcement
     * 
     * @param {String} searchTerm - Search term
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching staff
     */
    async searchStaff(searchTerm, userContext, options = {}) {
        const filters = {
            [Op.or]: [
                { firstName: { [Op.iLike]: `%${searchTerm}%` } },
                { lastName: { [Op.iLike]: `%${searchTerm}%` } },
                { email: { [Op.iLike]: `%${searchTerm}%` } }
            ]
        };

        return this.findVisibleStaff(userContext, filters, options);
    }
}

module.exports = StaffRepository;
