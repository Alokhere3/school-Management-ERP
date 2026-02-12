/**
 * Role Permission Service
 * Handles role-permission mappings and seeding default roles for tenants
 */
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');

// Default roles to create for each tenant (non-system roles from heat map)
const DEFAULT_TENANT_ROLES = [
    { name: 'School Admin', description: 'School administrator with full control' },
    { name: 'Principal', description: 'School principal with academic and admin oversight' },
    { name: 'Teacher', description: 'Teacher with access to classes, attendance, and grades' },
    { name: 'Accountant', description: 'Finance and accounting staff' },
    { name: 'HR Manager', description: 'Human Resources manager' },
    { name: 'Librarian', description: 'Library management staff' },
    { name: 'Transport Manager', description: 'Transport and logistics manager' },
    { name: 'Hostel Warden', description: 'Hostel management staff' },
    { name: 'Parent', description: 'Parent with limited access to child records' },
    { name: 'Student', description: 'Student with access to own records and LMS' }
];

// Access matrix from heat map (matching seedRBAC.js)
const ACCESS_MATRIX = {
    'School Admin': {
        tenant_management: 'limited',
        school_config: 'full',
        user_management: 'full',
        classes: 'full',
        students: 'full',
        admissions: 'full',
        fees: 'full',
        attendance_students: 'full',
        attendance_staff: 'full',
        timetable: 'full',
        exams: 'full',
        communication: 'full',
        transport: 'full',
        library: 'full',
        hostel: 'full',
        hr_payroll: 'full',
        inventory: 'full',
        lms: 'full',
        analytics: 'full',
        technical_ops: 'limited',
        data_export: 'limited'
    },
    'Principal': {
        tenant_management: 'none',
        school_config: 'read',
        user_management: 'limited',
        classes: 'full',
        students: 'full',
        admissions: 'full',
        fees: 'read',
        attendance_students: 'full',
        attendance_staff: 'read',
        timetable: 'full',
        exams: 'full',
        communication: 'full',
        transport: 'read',
        library: 'read',
        hostel: 'read',
        hr_payroll: 'read',
        inventory: 'read',
        lms: 'read',
        analytics: 'full',
        technical_ops: 'none',
        data_export: 'limited'
    },
    'Teacher': {
        tenant_management: 'none',
        school_config: 'read',
        user_management: 'none',
        classes: 'read',
        students: 'limited',
        admissions: 'limited',
        fees: 'read',
        attendance_students: 'full',
        attendance_staff: 'none',
        timetable: 'read',
        exams: 'limited',
        communication: 'limited',
        transport: 'read',
        library: 'read',
        hostel: 'none',
        hr_payroll: 'read',
        inventory: 'none',
        lms: 'full',
        analytics: 'limited',
        technical_ops: 'none',
        data_export: 'none'
    },
    'Accountant': {
        tenant_management: 'read',
        school_config: 'read',
        user_management: 'limited',
        classes: 'read',
        students: 'read',
        admissions: 'read',
        fees: 'full',
        attendance_students: 'read',
        attendance_staff: 'read',
        timetable: 'none',
        exams: 'none',
        communication: 'limited',
        transport: 'read',
        library: 'none',
        hostel: 'read',
        hr_payroll: 'full',
        inventory: 'read',
        lms: 'none',
        analytics: 'full',
        technical_ops: 'none',
        data_export: 'limited'
    },
    'HR Manager': {
        tenant_management: 'none',
        school_config: 'read',
        user_management: 'limited',
        classes: 'none',
        students: 'none',
        admissions: 'none',
        fees: 'read',
        attendance_students: 'read',
        attendance_staff: 'full',
        timetable: 'none',
        exams: 'none',
        communication: 'limited',
        transport: 'none',
        library: 'none',
        hostel: 'none',
        hr_payroll: 'full',
        inventory: 'none',
        lms: 'none',
        analytics: 'limited',
        technical_ops: 'none',
        data_export: 'limited'
    },
    'Librarian': {
        tenant_management: 'none',
        school_config: 'read',
        user_management: 'none',
        classes: 'none',
        students: 'limited',
        admissions: 'none',
        fees: 'read',
        attendance_students: 'none',
        attendance_staff: 'none',
        timetable: 'none',
        exams: 'read',
        communication: 'limited',
        transport: 'none',
        library: 'full',
        hostel: 'none',
        hr_payroll: 'none',
        inventory: 'limited',
        lms: 'read',
        analytics: 'limited',
        technical_ops: 'none',
        data_export: 'none'
    },
    'Transport Manager': {
        tenant_management: 'none',
        school_config: 'read',
        user_management: 'none',
        classes: 'read',
        students: 'limited',
        admissions: 'none',
        fees: 'read',
        attendance_students: 'limited',
        attendance_staff: 'limited',
        timetable: 'none',
        exams: 'none',
        communication: 'limited',
        transport: 'full',
        library: 'none',
        hostel: 'none',
        hr_payroll: 'none',
        inventory: 'none',
        lms: 'none',
        analytics: 'limited',
        technical_ops: 'none',
        data_export: 'none'
    },
    'Hostel Warden': {
        tenant_management: 'none',
        school_config: 'read',
        user_management: 'none',
        classes: 'read',
        students: 'limited',
        admissions: 'none',
        fees: 'read',
        attendance_students: 'limited',
        attendance_staff: 'none',
        timetable: 'none',
        exams: 'none',
        communication: 'limited',
        transport: 'none',
        library: 'none',
        hostel: 'full',
        hr_payroll: 'none',
        inventory: 'none',
        lms: 'none',
        analytics: 'limited',
        technical_ops: 'none',
        data_export: 'none'
    },
    'Parent': {
        tenant_management: 'none',
        school_config: 'none',
        user_management: 'none',
        classes: 'read',
        students: 'limited',
        admissions: 'limited',
        fees: 'limited',
        attendance_students: 'limited',
        attendance_staff: 'none',
        timetable: 'read',
        exams: 'read',
        communication: 'limited',
        transport: 'read',
        library: 'read',
        hostel: 'read',
        hr_payroll: 'none',
        inventory: 'none',
        lms: 'read',
        analytics: 'limited',
        technical_ops: 'none',
        data_export: 'limited'
    },
    'Student': {
        tenant_management: 'none',
        school_config: 'none',
        user_management: 'none',
        classes: 'read',
        students: 'limited',
        admissions: 'limited',
        fees: 'limited',
        attendance_students: 'limited',
        attendance_staff: 'none',
        timetable: 'read',
        exams: 'read',
        communication: 'limited',
        transport: 'read',
        library: 'read',
        hostel: 'read',
        hr_payroll: 'none',
        inventory: 'none',
        lms: 'full',
        analytics: 'limited',
        technical_ops: 'none',
        data_export: 'none'
    }
};

// Map access level to actions
const LEVEL_TO_ACTIONS = {
    'none': [],
    'read': ['read'],
    'limited': ['read'], // Limited typically means read-only with row-level filtering
    'full': ['create', 'read', 'update', 'delete']
};

/**
 * Seed default roles and permissions for a new tenant
 */
async function seedTenantRoles(tenantId) {
    try {
        // Ensure all permissions exist (they should already exist from seedRBAC)
        const MODULES = [
            'tenant_management', 'school_config', 'user_management', 'classes', 'students', 'admissions',
            'fees', 'attendance_students', 'attendance_staff', 'timetable', 'exams',
            'communication', 'transport', 'library', 'hostel', 'hr_payroll',
            'inventory', 'lms', 'analytics', 'technical_ops', 'data_export'
        ];
        const ACTIONS = ['create', 'read', 'update', 'delete', 'export'];

        // Create permissions if they don't exist
        for (const module of MODULES) {
            for (const action of ACTIONS) {
                await Permission.findOrCreate({
                    where: { resource: module, action },
                    defaults: {
                        description: `${action.toUpperCase()} action on ${module} resource`
                    }
                });
            }
        }

        // Create roles for this tenant
        const createdRoles = {};
        for (const roleDef of DEFAULT_TENANT_ROLES) {
            const [role] = await Role.findOrCreate({
                where: { name: roleDef.name, tenantId },
                defaults: {
                    description: roleDef.description,
                    isSystemRole: false
                }
            });
            createdRoles[roleDef.name] = role;
        }

        // Map roles to permissions based on ACCESS_MATRIX
        for (const [roleName, moduleAccessMap] of Object.entries(ACCESS_MATRIX)) {
            const role = createdRoles[roleName];
            if (!role) continue;

            for (const [module, level] of Object.entries(moduleAccessMap)) {
                const actions = LEVEL_TO_ACTIONS[level] || [];

                for (const action of actions) {
                    const permission = await Permission.findOne({
                        where: { resource: module, action }
                    });

                    if (permission) {
                        await RolePermission.findOrCreate({
                            where: {
                                roleId: role.id,
                                permissionId: permission.id
                            },
                            defaults: {
                                level: level
                            }
                        });
                    }
                }
            }
        }

        return createdRoles;
    } catch (error) {
        console.error('Error seeding tenant roles:', error);
        throw error;
    }
}

/**
 * Get role permissions
 */
async function getRolePermissions(roleId) {
    const Permission = require('../models/Permission');

    // 1. Fetch ALL system permissions
    const allPermissions = await Permission.findAll();

    // 2. Fetch ASSIGNED permissions for this role
    const rolePermissions = await RolePermission.findAll({
        where: { roleId },
        include: [
            {
                model: Permission,
                as: 'permission',
                required: true
            }
        ]
    });

    // 3. Create a map of assigned permissions for quick lookup
    const assignedMap = {};
    rolePermissions.forEach(rp => {
        assignedMap[rp.permissionId] = rp.level;
    });

    // 4. Merge and Group by module
    const permissionsByModule = {};

    allPermissions.forEach(perm => {
        const module = perm.resource;
        const action = perm.action;
        const level = assignedMap[perm.id] || 'none'; // Default to 'none' if not assigned

        if (!permissionsByModule[module]) {
            permissionsByModule[module] = {
                module,
                permissions: {}
            };
        }
        permissionsByModule[module].permissions[action] = level;
    });

    return Object.values(permissionsByModule);
}

/**
 * Update role permissions (bulk)
 */
/**
 * Helper: Map legacy level to new policy fields
 */
function mapLevelToPolicy(level) {
    if (typeof level === 'object' && level !== null) {
        return {
            effect: level.effect || 'allow',
            scope: level.scope || 'self',
            conditions: level.conditions || null
        };
    }

    // Default mapping for string levels
    // 'full' -> allow, tenant (max)
    // 'read' -> allow, tenant (max) - action restricted by permission itself
    // 'limited' -> allow, owned (typical for limited access)
    // 'none' -> deny (handled by caller usually, but here for completeness)
    switch (level) {
        case 'full':
            return { effect: 'allow', scope: 'tenant', conditions: null };
        case 'read':
            return { effect: 'allow', scope: 'tenant', conditions: null };
        case 'limited':
            return { effect: 'allow', scope: 'owned', conditions: null }; // Default limited to owned
        case 'none':
            return { effect: 'deny', scope: 'none', conditions: null };
        default:
            return { effect: 'allow', scope: 'self', conditions: null };
    }
}

/**
 * Update role permissions (bulk)
 */
async function updateRolePermissions(roleId, permissions) {
    // permissions format: [{ module: 'students', actions: { create: 'full', read: { effect: 'allow', scope: 'owned' } } }]
    const Permission = require('../models/Permission');
    const { Op } = require('sequelize');

    for (const perm of permissions) {
        const { module, actions } = perm;

        for (const [action, value] of Object.entries(actions)) {
            const permission = await Permission.findOne({
                where: { resource: module, action }
            });

            if (permission) {
                // Determine policy
                // If value is null/undefined/'none', remove/deny
                if (!value || value === 'none' || (value.effect === 'deny' && !value.scope)) {
                    // If explicit deny with scope/conditions, we might want to keep it?
                    // But legacy 'none' means remove row.
                    // Phase 2 says "No Partial Auth". 
                    // If we remove row, it falls back to implicit deny (Good).
                    // UNLESS we want Explicit Deny to override other allowed roles?
                    // For now, treat 'none' or null as REMOVE.
                    // If value is object { effect: 'deny' }, we CREATE it.
                }

                if (!value || value === 'none') {
                    // Remove permission
                    await RolePermission.destroy({
                        where: {
                            roleId,
                            permissionId: permission.id
                        }
                    });
                } else {
                    const policy = mapLevelToPolicy(value);

                    // Update or create permission
                    const [rolePermission, created] = await RolePermission.findOrCreate({
                        where: {
                            roleId,
                            permissionId: permission.id
                        },
                        defaults: {
                            level: typeof value === 'string' ? value : 'custom',
                            effect: policy.effect,
                            scope: policy.scope,
                            conditions: policy.conditions
                        }
                    });

                    // Update if changed
                    const newData = {
                        level: typeof value === 'string' ? value : 'custom',
                        effect: policy.effect,
                        scope: policy.scope,
                        conditions: policy.conditions
                    };

                    if (created) return;

                    // Check if update needed
                    if (rolePermission.effect !== newData.effect ||
                        rolePermission.scope !== newData.scope ||
                        JSON.stringify(rolePermission.conditions) !== JSON.stringify(newData.conditions) ||
                        rolePermission.level !== newData.level) {

                        await rolePermission.update(newData);
                    }
                }
            }
        }
    }
}

/**
 * Update a single permission for a role
 */
/**
 * Update a single permission for a role
 * Accepts level (string) OR policy object { effect, scope, conditions }
 */
async function updateSinglePermission(roleId, module, action, value) {
    const Permission = require('../models/Permission');

    const permission = await Permission.findOne({
        where: { resource: module, action }
    });

    if (!permission) {
        throw new Error(`Permission not found: ${module}.${action}`);
    }

    if (!value || value === 'none') {
        // Remove permission
        await RolePermission.destroy({
            where: {
                roleId,
                permissionId: permission.id
            }
        });
        return null;
    } else {
        const policy = mapLevelToPolicy(value);

        // Update or create permission
        const [rolePermission, created] = await RolePermission.findOrCreate({
            where: {
                roleId,
                permissionId: permission.id
            },
            defaults: {
                level: typeof value === 'string' ? value : 'custom',
                effect: policy.effect,
                scope: policy.scope,
                conditions: policy.conditions
            }
        });

        const newData = {
            level: typeof value === 'string' ? value : 'custom',
            effect: policy.effect,
            scope: policy.scope,
            conditions: policy.conditions
        };

        if (!created) {
            if (rolePermission.effect !== newData.effect ||
                rolePermission.scope !== newData.scope ||
                JSON.stringify(rolePermission.conditions) !== JSON.stringify(newData.conditions) ||
                rolePermission.level !== newData.level) {

                await rolePermission.update(newData);
            }
        }

        return rolePermission;
    }
}

/**
 * Update all permissions for a specific module
 */
/**
 * Update all permissions for a specific module
 */
async function updateModulePermissions(roleId, module, actions) {
    // actions format: { create: 'full', read: { effect: 'allow' }, ... }
    const Permission = require('../models/Permission');

    const permissions = await Permission.findAll({
        where: { resource: module }
    });

    for (const permission of permissions) {
        const value = actions[permission.action];

        if (value === 'none' || !value || value === undefined) {
            // Remove permission
            await RolePermission.destroy({
                where: {
                    roleId,
                    permissionId: permission.id
                }
            });
        } else {
            const policy = mapLevelToPolicy(value);

            // Update or create permission
            const [rolePermission, created] = await RolePermission.findOrCreate({
                where: {
                    roleId,
                    permissionId: permission.id
                },
                defaults: {
                    level: typeof value === 'string' ? value : 'custom',
                    effect: policy.effect,
                    scope: policy.scope,
                    conditions: policy.conditions
                }
            });

            const newData = {
                level: typeof value === 'string' ? value : 'custom',
                effect: policy.effect,
                scope: policy.scope,
                conditions: policy.conditions
            };

            if (!created) {
                if (rolePermission.effect !== newData.effect ||
                    rolePermission.scope !== newData.scope ||
                    JSON.stringify(rolePermission.conditions) !== JSON.stringify(newData.conditions) ||
                    rolePermission.level !== newData.level) {

                    await rolePermission.update(newData);
                }
            }
        }
    }
}

/**
 * Set "AllowAll" for a module (grants full access to all actions)
 */
async function setAllowAllForModule(roleId, module, allowAll) {
    const Permission = require('../models/Permission');

    const permissions = await Permission.findAll({
        where: { resource: module }
    });

    if (allowAll) {
        // Grant full access to all actions
        for (const permission of permissions) {
            const [rolePermission] = await RolePermission.findOrCreate({
                where: {
                    roleId,
                    permissionId: permission.id
                },
                defaults: {
                    level: 'full'
                }
            });

            if (rolePermission.level !== 'full') {
                await rolePermission.update({ level: 'full' });
            }
        }
    } else {
        // Remove all permissions for this module
        const permissionIds = permissions.map(p => p.id);
        await RolePermission.destroy({
            where: {
                roleId,
                permissionId: { [require('sequelize').Op.in]: permissionIds }
            }
        });
    }
}

module.exports = {
    seedTenantRoles,
    getRolePermissions,
    updateRolePermissions,
    updateSinglePermission,
    updateModulePermissions,
    setAllowAllForModule,
    DEFAULT_TENANT_ROLES,
    ACCESS_MATRIX,
    LEVEL_TO_ACTIONS,
    mapLevelToPolicy
};
