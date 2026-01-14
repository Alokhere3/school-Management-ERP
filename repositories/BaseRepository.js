/**
 * BaseRepository
 * 
 * CRITICAL: All data access MUST flow through repositories to enforce RLS.
 * This layer centralizes:
 * 1. Tenant isolation (mandatory filtering)
 * 2. Row-level security (permission-based access control)
 * 3. User context validation
 * 4. Audit logging
 * 
 * Direct model access (e.g., Model.findAll()) BYPASSES security and is forbidden.
 */

const logger = require('../config/logger');
const { Op } = require('sequelize');
const PermissionScope = require('../models/PermissionScope');

class BaseRepository {
    constructor(model, resourceName = null) {
        this.model = model;
        this.modelName = model.name;
        this.resourceName = resourceName || model.name.toLowerCase();
    }

    /**
     * CRITICAL: Validate and normalize user context
     * This is called on EVERY repository operation to ensure RLS enforcement
     * 
     * @param {Object} userContext - Contains userId, tenantId, role, roles, id
     * @returns {Object} Validated context with standardized properties
     * @throws {Error} If userContext is invalid or missing required fields
     */
    validateUserContext(userContext) {
        if (!userContext) {
            throw new Error('USER_CONTEXT_REQUIRED: RLS cannot be enforced without user context');
        }

        if (!userContext.tenantId) {
            throw new Error('TENANT_ISOLATION_FAILED: User context missing tenantId');
        }

        const userId = userContext.userId || userContext.id;
        if (!userId) {
            throw new Error('USER_ID_REQUIRED: User context missing userId');
        }

        // Normalize roles array
        const roles = userContext.roles || (userContext.role ? [userContext.role] : []);
        const primaryRole = roles[0] || userContext.role || 'user';

        return {
            userId,
            tenantId: userContext.tenantId,
            roles,
            role: primaryRole,
            permissions: userContext.permissions || {}
        };
    }

    /**
     * CRITICAL: Build base WHERE clause for tenant isolation
     * Every query MUST include tenantId filter to prevent cross-tenant data leakage
     * Also enforces soft-delete filtering (deletedAt IS NULL)
     * 
     * @param {Object} userContext - Validated user context
     * @returns {Object} Base WHERE clause with tenantId and soft-delete filtering
     */
    buildTenantFilter(userContext) {
        return {
            tenantId: userContext.tenantId,
            deletedAt: { [Op.is]: null } // Soft-delete enforcement: NEVER return deleted records
        };
    }

    /**
     * CRITICAL: Apply row-level security filters
     * Now uses permission-scope model instead of hardcoded roles
     * Scopes: TENANT (all) | OWNED (related) | SELF (own record) | NONE (denied)
     * 
     * @param {Object} where - Existing WHERE clause
     * @param {Object} userContext - Validated user context
     * @param {String} action - 'read', 'update', 'delete'
     * @returns {Object} WHERE clause with RLS filters applied
     */
    applyRLSFilters(where, userContext, action = 'read') {
        const baseWhere = { ...where, ...this.buildTenantFilter(userContext) };

        const { role, userId, roles } = userContext;

        // Get permission scope using permission model (no hardcoded roles)
        const scope = PermissionScope.getMaxScope(this.resourceName, roles);

        logger.debug({
            message: 'RLS_SCOPE_RESOLUTION',
            resource: this.resourceName,
            roles,
            scope,
            userId,
            tenantId: userContext.tenantId
        });

        // Apply access restrictions based on scope
        switch (scope) {
            case PermissionScope.SCOPES.TENANT:
                // TENANT scope: User sees all records in their tenant
                // No additional WHERE clause needed (already filtered by tenantId)
                return baseWhere;

            case PermissionScope.SCOPES.OWNED:
                // OWNED scope: User sees records they own or are related to
                // Repository-specific implementation: StudentRepository, StaffRepository, etc.
                // This is customized per entity repository (not in base)
                return this.applyOwnedFilter(baseWhere, userContext, action);

            case PermissionScope.SCOPES.SELF:
                // SELF scope: User sees only their own record
                baseWhere.userId = userId;
                return baseWhere;

            case PermissionScope.SCOPES.NONE:
                // NONE scope: User has no access - return impossible condition
                baseWhere.id = { [Op.eq]: null }; // Will return no records
                return baseWhere;

            default:
                throw new Error(`UNKNOWN_SCOPE: ${scope}`);
        }
    }

    /**
     * Apply OWNED scope filters
     * This method should be overridden in specific repositories
     * for resource-specific owned filtering (e.g., StudentRepository filters by teacherId)
     * 
     * @param {Object} where - WHERE clause with tenantId already included
     * @param {Object} userContext - User context
     * @param {String} action - 'read', 'update', 'delete'
     * @returns {Object} Updated WHERE clause
     */
    applyOwnedFilter(where, userContext, action = 'read') {
        // Default: For OWNED scope, restrict to user's own records
        // Repositories can override this for more complex logic
        if (action !== 'read') {
            where.userId = userContext.userId;
        }
        return where;
    }

    /**
     * Audit log all data access
     * Called on every repository operation for security monitoring
     * 
     * @param {String} action - Operation type (read, create, update, delete)
     * @param {Object} userContext - User performing the action
     * @param {String} details - Additional context
     */
    auditLog(action, userContext, details = '') {
        logger.info({
            message: 'RLS_DATA_ACCESS',
            model: this.modelName,
            action,
            userId: userContext.userId,
            tenantId: userContext.tenantId,
            role: userContext.role,
            timestamp: new Date().toISOString(),
            details
        });
    }

    /**
     * CRITICAL: Find one record with RLS enforcement
     * 
     * @param {String} id - Record ID
     * @param {Object} userContext - Validated user context
     * @param {Object} options - Additional query options
     * @returns {Promise<Object|null>} Found record or null
     */
    async findByIdWithRLS(id, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('findById', context, `id=${id}`);

        const where = this.applyRLSFilters({ id }, context, 'read');
        return this.model.findOne({ where, ...options });
    }

    /**
     * CRITICAL: Find all records with RLS enforcement
     * 
     * @param {Object} userContext - Validated user context
     * @param {Object} filters - Additional WHERE filters
     * @param {Object} options - Pagination, sorting, etc.
     * @returns {Promise<Array>} Records matching RLS-filtered criteria
     */
    async findAllWithRLS(userContext, filters = {}, options = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('findAll', context, `filters=${JSON.stringify(filters)}`);

        const where = this.applyRLSFilters(filters, context, 'read');
        
        const { page = 1, limit = 20, offset = 0, order, raw = false } = options;
        const calculatedOffset = offset || (page - 1) * limit;

        return this.model.findAll({
            where,
            limit,
            offset: calculatedOffset,
            order,
            raw,
            ...options
        });
    }

    /**
     * CRITICAL: Find and count with RLS enforcement (for pagination)
     * 
     * @param {Object} userContext - Validated user context
     * @param {Object} filters - Additional WHERE filters
     * @param {Object} options - Pagination, sorting, etc.
     * @returns {Promise<Object>} { count, rows }
     */
    async findAndCountWithRLS(userContext, filters = {}, options = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('findAndCount', context, `filters=${JSON.stringify(filters)}`);

        const where = this.applyRLSFilters(filters, context, 'read');
        
        const { page = 1, limit = 20, offset = 0, order, raw = false } = options;
        const calculatedOffset = offset || (page - 1) * limit;

        const { count, rows } = await this.model.findAndCountAll({
            where,
            limit,
            offset: calculatedOffset,
            order,
            raw,
            distinct: true
        });

        return { count, rows };
    }

    /**
     * CRITICAL: Create record with RLS enforcement
     * Automatically applies tenant isolation
     * 
     * @param {Object} data - Record data to create
     * @param {Object} userContext - Validated user context
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created record
     */
    async createWithRLS(data, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('create', context, `fields=${Object.keys(data).join(',')}`);

        // CRITICAL: Enforce tenant isolation on create
        const recordData = {
            ...data,
            tenantId: context.tenantId // Force tenant ID - cannot be overridden
        };

        return this.model.create(recordData, options);
    }

    /**
     * CRITICAL: Update record with RLS enforcement
     * Only allows updating records the user has access to
     * 
     * @param {String} id - Record ID to update
     * @param {Object} data - Fields to update
     * @param {Object} userContext - Validated user context
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} [rowsUpdated, updatedRecords]
     */
    async updateWithRLS(id, data, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('update', context, `id=${id}, fields=${Object.keys(data).join(',')}`);

        // Prevent tenant ID from being modified
        const { tenantId, ...safeData } = data;

        const where = this.applyRLSFilters({ id }, context, 'update');
        return this.model.update(safeData, { where, ...options });
    }

    /**
     * CRITICAL: Delete record with RLS enforcement
     * Only allows deleting records the user has access to
     * 
     * @param {String} id - Record ID to delete
     * @param {Object} userContext - Validated user context
     * @param {Object} options - Additional options
     * @returns {Promise<Number>} Number of rows deleted
     */
    async deleteWithRLS(id, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('delete', context, `id=${id}`);

        const where = this.applyRLSFilters({ id }, context, 'delete');
        return this.model.destroy({ where, ...options });
    }

    /**
     * Helper: Check if user has specific role
     * 
     * @param {Object} userContext - User context
     * @param {String|Array} roles - Role(s) to check
     * @returns {Boolean}
     */
    hasRole(userContext, roles) {
        const context = this.validateUserContext(userContext);
        const rolesArray = Array.isArray(roles) ? roles : [roles];
        return rolesArray.some(r => 
            context.roles.some(ur => ur.toLowerCase().includes(r.toLowerCase()))
        );
    }

    /**
     * Helper: Check if user is admin
     * 
     * @param {Object} userContext - User context
     * @returns {Boolean}
     */
    isAdmin(userContext) {
        return this.hasRole(userContext, ['admin', 'super_admin', 'superadmin']);
    }
}

module.exports = BaseRepository;
