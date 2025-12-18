/**
 * RBAC Seed Data
 * 
 * Populates roles, permissions, and role-permission mappings
 * based on the ERP access control matrix.
 * 
 * Run: node scripts/seedRBAC.js
 */

require('dotenv').config();

const { sequelize } = require('../config/database');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');

// Define all 20 modules and their base CRUD permissions
const MODULES = [
    'tenant_management',       // Tenant Mgmt & Billing
    'school_config',           // School Config & Academic Year
    'user_management',         // User & Role Mgmt
    'students',                // Student Info (SIS)
    'admissions',              // Admissions & Enquiries
    'fees',                    // Fees & Payments
    'attendance_students',     // Attendance (Students)
    'attendance_staff',        // Attendance (Staff)
    'timetable',              // Timetable & Scheduling
    'exams',                  // Exams & Report Cards
    'communication',          // Communication & Notifications
    'transport',              // Transport Mgmt
    'library',                // Library Mgmt
    'hostel',                 // Hostel Mgmt
    'hr_payroll',             // HR & Payroll
    'inventory',              // Inventory & Assets
    'lms',                    // LMS / Online Learning
    'analytics',              // Analytics & Reports
    'technical_ops',          // Technical Ops (Backups, Logs)
    'data_export'             // Data Export & Compliance
];

const ACTIONS = ['create', 'read', 'update', 'delete', 'export'];

// Define 11 roles
const ROLES = [
    {
        name: 'Super Admin',
        description: 'Cross-tenant system administrator (SaaS)',
        isSystemRole: true
    },
    {
        name: 'School Admin',
        description: 'School administrator with full control',
        isSystemRole: false
    },
    {
        name: 'Principal',
        description: 'School principal with academic and admin oversight',
        isSystemRole: false
    },
    {
        name: 'Teacher',
        description: 'Teacher with access to classes, attendance, and grades',
        isSystemRole: false
    },
    {
        name: 'Accountant',
        description: 'Finance and accounting staff',
        isSystemRole: false
    },
    {
        name: 'HR Manager',
        description: 'Human Resources manager',
        isSystemRole: false
    },
    {
        name: 'Librarian',
        description: 'Library management staff',
        isSystemRole: false
    },
    {
        name: 'Transport Manager',
        description: 'Transport and logistics manager',
        isSystemRole: false
    },
    {
        name: 'Hostel Warden',
        description: 'Hostel management staff',
        isSystemRole: false
    },
    {
        name: 'Parent',
        description: 'Parent with limited access to child records',
        isSystemRole: false
    },
    {
        name: 'Student',
        description: 'Student with access to own records and LMS',
        isSystemRole: false
    },
    {
        name: 'Support Engineer',
        description: 'SaaS support staff with cross-tenant access',
        isSystemRole: true
    }
];

// Access matrix: role -> module -> level
// Levels: 'none', 'read', 'limited', 'full'
const ACCESS_MATRIX = {
    'Super Admin': {
        tenant_management: 'full',
        school_config: 'full',
        user_management: 'full',
        students: 'read',
        admissions: 'read',
        fees: 'read',
        attendance_students: 'read',
        attendance_staff: 'read',
        timetable: 'read',
        exams: 'read',
        communication: 'limited',
        transport: 'read',
        library: 'read',
        hostel: 'read',
        hr_payroll: 'read',
        inventory: 'read',
        lms: 'read',
        analytics: 'full',
        technical_ops: 'full',
        data_export: 'full'
    },
    'School Admin': {
        tenant_management: 'limited',
        school_config: 'full',
        user_management: 'full',
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
        students: 'limited',
        admissions: 'none',
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
    },
    'Support Engineer': {
        tenant_management: 'full',
        school_config: 'read',
        user_management: 'read',
        students: 'read',
        admissions: 'read',
        fees: 'read',
        attendance_students: 'read',
        attendance_staff: 'read',
        timetable: 'read',
        exams: 'read',
        communication: 'read',
        transport: 'read',
        library: 'read',
        hostel: 'read',
        hr_payroll: 'read',
        inventory: 'read',
        lms: 'read',
        analytics: 'full',
        technical_ops: 'full',
        data_export: 'full'
    }
};

/**
 * Seed the database
 */
async function seed() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // Ensure all permissions exist
        console.log('📝 Creating permissions...');
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
        console.log(`✅ Created ${MODULES.length * ACTIONS.length} permissions`);

        // Ensure all roles exist
        console.log('👥 Creating roles...');
        const createdRoles = {};
        for (const roleDef of ROLES) {
            const [role] = await Role.findOrCreate({
                where: { name: roleDef.name, tenantId: null }, // System roles have tenantId = null
                defaults: {
                    description: roleDef.description,
                    isSystemRole: roleDef.isSystemRole
                }
            });
            createdRoles[roleDef.name] = role;
        }
        console.log(`✅ Created ${ROLES.length} roles`);

        // Create role-permission mappings based on ACCESS_MATRIX
        console.log('🔐 Mapping roles to permissions...');
        let mappingCount = 0;

        for (const [roleName, moduleAccessMap] of Object.entries(ACCESS_MATRIX)) {
            const role = createdRoles[roleName];
            if (!role) {
                console.warn(`⚠️  Role not found: ${roleName}`);
                continue;
            }

            for (const [module, level] of Object.entries(moduleAccessMap)) {
                if (level === 'none') {
                    continue; // Skip 'none' entries to keep DB clean
                }

                // Find all permissions for this module
                const permissions = await Permission.findAll({
                    where: { resource: module }
                });

                for (const permission of permissions) {
                    // Determine which actions are allowed based on level
                    let allowAction = false;
                    if (level === 'full' && ['create', 'read', 'update', 'delete', 'export'].includes(permission.action)) {
                        allowAction = true;
                    } else if (level === 'read' && permission.action === 'read') {
                        allowAction = true;
                    } else if (level === 'limited' && permission.action === 'read') {
                        // Limited = read with row-level filtering
                        allowAction = true;
                    } else if (level === 'full' && permission.action === 'read') {
                        // Full includes read
                        allowAction = true;
                    }

                    if (allowAction) {
                        await RolePermission.findOrCreate({
                            where: { roleId: role.id, permissionId: permission.id },
                            defaults: { level }
                        });
                        mappingCount++;
                    }
                }
            }
        }
        console.log(`✅ Created ${mappingCount} role-permission mappings`);

        console.log('\n✅ RBAC seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

seed();
