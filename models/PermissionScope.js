/**
 * PermissionScope Model
 * 
 * Decouples RLS from hardcoded roles.
 * Permissions map to scopes that control data visibility.
 * 
 * Scopes:
 * - TENANT: User sees all records in their tenant (admins)
 * - OWNED: User sees records they own or are related to
 * - SELF: User sees only their own record (students, staff viewing own record)
 * - NONE: No access (default)
 */

class PermissionScope {
    // Define scopes globally
    static SCOPES = {
        TENANT: 'TENANT',      // See all in tenant
        OWNED: 'OWNED',        // See owned/related
        SELF: 'SELF',          // See own record only
        NONE: 'NONE'           // No access
    };

    // Map: resourceName -> Map: role -> scope
    static ROLE_PERMISSION_MAP = {
        student: {
            admin: this.SCOPES.TENANT,
            school_admin: this.SCOPES.TENANT,
            principal: this.SCOPES.TENANT,
            teacher: this.SCOPES.OWNED,     // See assigned students
            parent: this.SCOPES.OWNED,      // See own children
            student: this.SCOPES.SELF,      // See own record
            staff: this.SCOPES.SELF         // Staff see own record
        },
        staff: {
            admin: this.SCOPES.TENANT,
            school_admin: this.SCOPES.TENANT,
            principal: this.SCOPES.TENANT,
            hr_manager: this.SCOPES.TENANT,
            teacher: this.SCOPES.SELF,      // Teachers see own record
            staff: this.SCOPES.SELF         // Staff see own record
        },
        teacher: {
            admin: this.SCOPES.TENANT,
            school_admin: this.SCOPES.TENANT,
            principal: this.SCOPES.TENANT,
            teacher: this.SCOPES.SELF,      // Teachers see own record
            staff: this.SCOPES.SELF         // Staff see own record
        },
        class: {
            admin: this.SCOPES.TENANT,
            school_admin: this.SCOPES.TENANT,
            principal: this.SCOPES.TENANT,
            teacher: this.SCOPES.OWNED,     // See assigned classes
            student: this.SCOPES.OWNED      // See own class
        },
        user: {
            admin: this.SCOPES.TENANT,
            school_admin: this.SCOPES.TENANT,
            principal: this.SCOPES.TENANT,
            user: this.SCOPES.SELF          // See own record
        }
    };

    /**
     * Get scope for user accessing resource
     * 
     * Usage:
     *   const scope = PermissionScope.getScope('student', 'teacher');
     *   // Returns: 'OWNED'
     * 
     * @param {String} resourceName - 'student', 'staff', 'class', 'user'
     * @param {String} role - User's role
     * @returns {String} Scope: 'TENANT', 'OWNED', 'SELF', or 'NONE'
     */
    static getScope(resourceName, role) {
        const normalizedRole = (role || '').toLowerCase().replace(/\s+/g, '_');
        const resourceMap = this.ROLE_PERMISSION_MAP[resourceName];

        if (!resourceMap) {
            // Unknown resource → deny by default
            return this.SCOPES.NONE;
        }

        return resourceMap[normalizedRole] || this.SCOPES.NONE;
    }

    /**
     * Get all scopes for multiple roles (precedence: TENANT > OWNED > SELF > NONE)
     * 
     * Usage:
     *   const scope = PermissionScope.getMaxScope('student', ['teacher', 'principal']);
     *   // Returns: 'TENANT' (principal's TENANT scope wins)
     * 
     * @param {String} resourceName - Resource being accessed
     * @param {Array} roles - Array of role strings
     * @returns {String} Highest scope from all roles
     */
    static getMaxScope(resourceName, roles = []) {
        const scopes = roles.map(role => this.getScope(resourceName, role));

        // Precedence order
        if (scopes.includes(this.SCOPES.TENANT)) return this.SCOPES.TENANT;
        if (scopes.includes(this.SCOPES.OWNED)) return this.SCOPES.OWNED;
        if (scopes.includes(this.SCOPES.SELF)) return this.SCOPES.SELF;
        return this.SCOPES.NONE;
    }
}

module.exports = PermissionScope;
