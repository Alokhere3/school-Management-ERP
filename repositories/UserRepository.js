/**
 * UserRepository
 * 
 * Extends BaseRepository with user-specific RLS rules.
 * CRITICAL: All user data access MUST flow through this repository.
 * 
 * RLS Rules:
 * - Admin: See all users in their tenant
 * - User: See only their own record
 */

const BaseRepository = require('./BaseRepository');
const { Op } = require('sequelize');

class UserRepository extends BaseRepository {
    /**
     * CRITICAL: Apply user-specific RLS filters
     * 
     * @param {Object} where - Existing WHERE clause
     * @param {Object} userContext - Validated user context
     * @param {String} action - 'read', 'update', 'delete'
     * @returns {Object} WHERE clause with user RLS filters
     */
    applyRLSFilters(where, userContext, action = 'read') {
        const baseWhere = { ...where, ...this.buildTenantFilter(userContext) };
        const { role, userId } = userContext;

        switch (role.toLowerCase()) {
            case 'admin':
            case 'super_admin':
            case 'superadmin':
                return baseWhere;

            default:
                // Users see only their own record
                baseWhere.id = userId;
                return baseWhere;
        }
    }

    /**
     * CRITICAL: Find visible users
     * 
     * @param {Object} userContext - User context
     * @param {Object} filters - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Object>} { count, rows }
     */
    async findVisibleUsers(userContext, filters = {}, options = {}) {
        return this.findAndCountWithRLS(userContext, filters, options);
    }

    /**
     * Find user by ID with RLS enforcement
     * 
     * @param {String} id - User ID
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} User or null
     */
    async findUserById(id, userContext, options = {}) {
        return this.findByIdWithRLS(id, userContext, options);
    }

    /**
     * Find user by email with tenant isolation
     * 
     * @param {String} email - Email
     * @param {Object} userContext - User context
     * @returns {Promise<Object|null>} User or null
     */
    async findUserByEmail(email, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        
        // Only admins can search by email
        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Cannot search users by email');
        }

        const where = { email, tenantId: context.tenantId };
        return this.model.findOne({ where, ...options });
    }

    /**
     * Create user with RLS enforcement
     * 
     * @param {Object} userData - User fields
     * @param {Object} userContext - User context
     * @returns {Promise<Object>} Created user
     */
    async createUser(userData, userContext) {
        const context = this.validateUserContext(userContext);
        
        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can create users');
        }

        return this.createWithRLS(userData, userContext);
    }

    /**
     * Update user with RLS enforcement
     * 
     * @param {String} userId - User ID
     * @param {Object} updateData - Fields to update
     * @param {Object} userContext - User context
     * @returns {Promise<Array>} [rowsUpdated, updatedRecords]
     */
    async updateUser(userId, updateData, userContext) {
        const context = this.validateUserContext(userContext);
        
        // Users can update themselves, admins can update anyone
        if (context.userId !== userId && !this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Cannot modify other users');
        }

        return this.updateWithRLS(userId, updateData, userContext);
    }

    /**
     * Delete user with RLS enforcement
     * 
     * @param {String} userId - User ID
     * @param {Object} userContext - User context
     * @returns {Promise<Number>} Rows deleted
     */
    async deleteUser(userId, userContext) {
        const context = this.validateUserContext(userContext);
        
        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can delete users');
        }

        return this.deleteWithRLS(userId, userContext);
    }

    /**
     * Find users by role with RLS enforcement
     * 
     * @param {String} role - Role to filter by
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Users with role
     */
    async findUsersByRole(role, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        
        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Cannot list users');
        }

        return this.findVisibleUsers(userContext, { role }, options);
    }

    /**
     * Search users by name with RLS enforcement
     * 
     * @param {String} searchTerm - Search term
     * @param {Object} userContext - User context
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching users
     */
    async searchUsers(searchTerm, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        
        if (!this.isAdmin(context)) {
            throw new Error('INSUFFICIENT_PERMISSIONS: Cannot search users');
        }

        const filters = {
            [Op.or]: [
                { firstName: { [Op.iLike]: `%${searchTerm}%` } },
                { lastName: { [Op.iLike]: `%${searchTerm}%` } },
                { email: { [Op.iLike]: `%${searchTerm}%` } }
            ]
        };

        return this.findVisibleUsers(userContext, filters, options);
    }
}

module.exports = UserRepository;
