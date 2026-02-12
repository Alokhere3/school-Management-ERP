/**
 * ScopeResolver Service
 * 
 * Standardizes scope resolution for RLS.
 * Replaces legacy PermissionScope logic.
 * 
 * Usage:
 * const { scope, conditions, allowed } = ScopeResolver.resolve(userContext, 'student', 'read');
 */

const logger = require('../config/logger');

class ScopeResolver {
    /**
     * Resolve scope and conditions for a user action on a resource
     * 
     * @param {Object} userContext - User context with permissions
     * @param {String} resource - Resource name (e.g., 'student')
     * @param {String} action - Action name (e.g., 'read')
     * @returns {Object} { allowed, scope, conditions, reason }
     */
    static resolve(userContext, resource, action) {
        const { permissions, userId, tenantId } = userContext;

        if (!permissions) {
            return {
                allowed: false,
                reason: 'NO_PERMISSIONS_OBJECT'
            };
        }

        const key = `${resource}:${action}`;
        const policy = permissions[key];

        // 1. Check if policy exists
        if (!policy) {
            // Check for wildcard or default? 
            // Phase 2 strictness says "Fail closed".
            return {
                allowed: false,
                reason: 'NO_MATCHING_POLICY'
            };
        }

        // 2. Check explicitly allowed
        if (!policy.allowed) {
            return {
                allowed: false,
                reason: policy.reason || 'EXPLICIT_DENY'
            };
        }

        // 3. Return resolved scope and conditions
        return {
            allowed: true,
            scope: policy.scope || 'self', // Default to safest
            conditions: policy.conditions || []
        };
    }

    /**
     * Get hierarchy rank for scope (higher is more permissive)
     */
    static getScopeRank(scope) {
        const RANKS = {
            'none': 0,
            'self': 10,
            'owned': 20,
            'tenant': 30,
            'all': 99 // System admin only
        };
        return RANKS[scope] || 0;
    }
}

module.exports = ScopeResolver;
