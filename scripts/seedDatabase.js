#!/usr/bin/env node

/**
 * Comprehensive Database Seed Script
 * 
 * Creates:
 * - All system roles (Super Admin)
 * - All permissions and RBAC mappings
 * - A Super Admin user
 * 
 * Usage:
 *   npm run seed
 *   OR
 *   node scripts/seedDatabase.js
 * 
 * Environment Variables Required:
 *   DATABASE_URL - or use config/database.js defaults
 *   SUPER_ADMIN_EMAIL - email for super admin (default: admin@schoolerp.com)
 *   SUPER_ADMIN_PASSWORD - password for super admin (default: SuperAdmin@123)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const UserRole = require('../models/UserRole');
const Tenant = require('../models/Tenant');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@schoolerp.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const SUPER_ADMIN_NAME = 'System Administrator';

// All modules/resources in the system
const MODULES = [
    'tenant_management',
    'school_config',
    'user_management',
    'students',
    'admissions',
    'fees',
    'attendance_students',
    'attendance_staff',
    'timetable',
    'exams',
    'communication',
    'transport',
    'library',
    'hostel',
    'hr_payroll',
    'inventory',
    'lms',
    'analytics',
    'technical_ops',
    'data_export'
];

// All possible actions
const ACTIONS = ['create', 'read', 'update', 'delete', 'export'];

// System roles (global, available to all tenants)
const SYSTEM_ROLES = [
    {
        name: 'Super Admin',
        description: 'System-wide super administrator with complete control',
        isSystemRole: true,
        tenantId: null, // System roles are global
        accessLevel: 'full' // Full access to all modules and actions
    }
];

// Tenant-level roles (created per tenant)
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

// Access matrix for tenant roles (module -> level mapping)
const ACCESS_MATRIX = {
    'School Admin': {
        tenant_management: 'limited', school_config: 'full', user_management: 'full',
        students: 'full', admissions: 'full', fees: 'full', attendance_students: 'full',
        attendance_staff: 'full', timetable: 'full', exams: 'full', communication: 'full',
        transport: 'full', library: 'full', hostel: 'full', hr_payroll: 'full',
        inventory: 'full', lms: 'full', analytics: 'full', technical_ops: 'limited',
        data_export: 'limited'
    },
    'Principal': {
        tenant_management: 'none', school_config: 'read', user_management: 'limited',
        students: 'full', admissions: 'full', fees: 'read', attendance_students: 'full',
        attendance_staff: 'read', timetable: 'full', exams: 'full', communication: 'full',
        transport: 'read', library: 'read', hostel: 'read', hr_payroll: 'read',
        inventory: 'read', lms: 'read', analytics: 'full', technical_ops: 'none',
        data_export: 'limited'
    },
    'Teacher': {
        tenant_management: 'none', school_config: 'read', user_management: 'none',
        students: 'limited', admissions: 'none', fees: 'read', attendance_students: 'full',
        attendance_staff: 'none', timetable: 'read', exams: 'limited', communication: 'limited',
        transport: 'read', library: 'read', hostel: 'none', hr_payroll: 'read',
        inventory: 'none', lms: 'full', analytics: 'limited', technical_ops: 'none',
        data_export: 'none'
    },
    'Accountant': {
        tenant_management: 'read', school_config: 'read', user_management: 'limited',
        students: 'read', admissions: 'read', fees: 'full', attendance_students: 'read',
        attendance_staff: 'read', timetable: 'none', exams: 'none', communication: 'limited',
        transport: 'read', library: 'none', hostel: 'read', hr_payroll: 'full',
        inventory: 'read', lms: 'none', analytics: 'full', technical_ops: 'none',
        data_export: 'limited'
    },
    'HR Manager': {
        tenant_management: 'none', school_config: 'read', user_management: 'limited',
        students: 'none', admissions: 'none', fees: 'read', attendance_students: 'read',
        attendance_staff: 'full', timetable: 'none', exams: 'none', communication: 'limited',
        transport: 'none', library: 'none', hostel: 'none', hr_payroll: 'full',
        inventory: 'none', lms: 'none', analytics: 'limited', technical_ops: 'none',
        data_export: 'limited'
    },
    'Librarian': {
        tenant_management: 'none', school_config: 'read', user_management: 'none',
        students: 'limited', admissions: 'none', fees: 'read', attendance_students: 'none',
        attendance_staff: 'none', timetable: 'none', exams: 'read', communication: 'limited',
        transport: 'none', library: 'full', hostel: 'none', hr_payroll: 'none',
        inventory: 'limited', lms: 'read', analytics: 'limited', technical_ops: 'none',
        data_export: 'none'
    },
    'Transport Manager': {
        tenant_management: 'none', school_config: 'read', user_management: 'none',
        students: 'limited', admissions: 'none', fees: 'read', attendance_students: 'limited',
        attendance_staff: 'limited', timetable: 'none', exams: 'none', communication: 'limited',
        transport: 'full', library: 'none', hostel: 'none', hr_payroll: 'none',
        inventory: 'none', lms: 'none', analytics: 'limited', technical_ops: 'none',
        data_export: 'none'
    },
    'Hostel Warden': {
        tenant_management: 'none', school_config: 'read', user_management: 'none',
        students: 'limited', admissions: 'none', fees: 'read', attendance_students: 'limited',
        attendance_staff: 'none', timetable: 'none', exams: 'none', communication: 'limited',
        transport: 'none', library: 'none', hostel: 'full', hr_payroll: 'none',
        inventory: 'none', lms: 'none', analytics: 'limited', technical_ops: 'none',
        data_export: 'none'
    },
    'Parent': {
        tenant_management: 'none', school_config: 'none', user_management: 'none',
        students: 'limited', admissions: 'limited', fees: 'limited', attendance_students: 'limited',
        attendance_staff: 'none', timetable: 'read', exams: 'read', communication: 'limited',
        transport: 'read', library: 'read', hostel: 'read', hr_payroll: 'none',
        inventory: 'none', lms: 'read', analytics: 'limited', technical_ops: 'none',
        data_export: 'limited'
    },
    'Student': {
        tenant_management: 'none', school_config: 'none', user_management: 'none',
        students: 'limited', admissions: 'limited', fees: 'limited', attendance_students: 'limited',
        attendance_staff: 'none', timetable: 'read', exams: 'read', communication: 'limited',
        transport: 'read', library: 'read', hostel: 'read', hr_payroll: 'none',
        inventory: 'none', lms: 'full', analytics: 'limited', technical_ops: 'none',
        data_export: 'none'
    }
};

// Map access level to actions
const LEVEL_TO_ACTIONS = {
    'none': [],
    'read': ['read'],
    'limited': ['read'],
    'full': ['create', 'read', 'update', 'delete']
};

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seed() {
    const startTime = new Date();
    console.log('\n');
    console.log('═'.repeat(80));
    console.log('🌱 Database Seed Script - Initializing RBAC and Super Admin');
    console.log('═'.repeat(80));

    try {
        // Step 1: Connect to database
        console.log('\n1️⃣  Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connection successful');

        // Step 2: Sync models
        console.log('\n2️⃣  Syncing database models...');
        await sequelize.sync();
        console.log('✅ Database models synchronized');

        // Step 3: Create all permissions
        console.log('\n3️⃣  Creating permissions...');
        const permissionsMap = {};
        let permissionCount = 0;

        for (const module of MODULES) {
            for (const action of ACTIONS) {
                const [permission] = await Permission.findOrCreate({
                    where: { resource: module, action },
                    defaults: {
                        description: `${action.toUpperCase()} action on ${module} resource`
                    }
                });
                permissionsMap[`${module}:${action}`] = permission;
                permissionCount++;
            }
        }
        console.log(`✅ Created/verified ${permissionCount} permissions`);

        // Step 4: Create system roles
        console.log('\n4️⃣  Creating system roles...');
        const systemRolesMap = {};

        for (const roleDef of SYSTEM_ROLES) {
            const [role] = await Role.findOrCreate({
                where: { name: roleDef.name, tenantId: null },
                defaults: {
                    description: roleDef.description,
                    isSystemRole: true
                }
            });
            systemRolesMap[roleDef.name] = role;
            console.log(`   ✓ System role: ${roleDef.name}`);
        }

        // Step 5: Map system role permissions (Super Admin = full access)
        console.log('\n5️⃣  Mapping system role permissions...');
        const superAdminRole = systemRolesMap['Super Admin'];

        for (const module of MODULES) {
            for (const action of ACTIONS) {
                const permission = permissionsMap[`${module}:${action}`];
                if (permission) {
                    await RolePermission.findOrCreate({
                        where: {
                            roleId: superAdminRole.id,
                            permissionId: permission.id
                        }
                    });
                }
            }
        }
        console.log(`✅ Mapped ${MODULES.length * ACTIONS.length} permissions to Super Admin role`);

        // Step 6: Create default tenant (for seeding tenant roles)
        console.log('\n6️⃣  Creating default system tenant...');
        const [systemTenant] = await Tenant.findOrCreate({
            where: { slug: 'system' },
            defaults: {
                name: 'System Tenant (Admin Portal)',
                slug: 'system'
            }
        });
        console.log(`✅ System tenant: ${systemTenant.name} (ID: ${systemTenant.id})`);

        // Step 7: Create tenant-level roles and permissions
        console.log('\n7️⃣  Creating tenant-level roles and permissions...');
        const tenantRolesMap = {};

        for (const roleDef of DEFAULT_TENANT_ROLES) {
            const [role] = await Role.findOrCreate({
                where: { name: roleDef.name, tenantId: systemTenant.id },
                defaults: {
                    description: roleDef.description,
                    isSystemRole: false
                }
            });
            tenantRolesMap[roleDef.name] = role;
            console.log(`   ✓ Tenant role: ${roleDef.name}`);

            // Map permissions for this role
            const moduleAccessMap = ACCESS_MATRIX[roleDef.name] || {};
            for (const [module, level] of Object.entries(moduleAccessMap)) {
                const actions = LEVEL_TO_ACTIONS[level] || [];
                for (const action of actions) {
                    const permission = permissionsMap[`${module}:${action}`];
                    if (permission) {
                        await RolePermission.findOrCreate({
                            where: {
                                roleId: role.id,
                                permissionId: permission.id
                            }
                        });
                    }
                }
            }
        }
        console.log(`✅ Created ${DEFAULT_TENANT_ROLES.length} tenant-level roles`);

        // Step 8: Create Super Admin user
        console.log('\n8️⃣  Creating Super Admin user...');
        
        // Check if user already exists
        let superAdminUser = await User.findOne({ where: { email: SUPER_ADMIN_EMAIL } });
        
        if (superAdminUser) {
            console.log(`   ⚠️  User ${SUPER_ADMIN_EMAIL} already exists. Updating password...`);
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 14);
            await superAdminUser.update({ passwordHash: hashedPassword });
        } else {
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 14);
            superAdminUser = await User.create({
                email: SUPER_ADMIN_EMAIL,
                passwordHash: hashedPassword,
                status: 'active',
                mustChangePassword: false,
                tenantId: systemTenant.id
            });
            console.log(`   ✓ Created user: ${SUPER_ADMIN_EMAIL}`);
        }

        // Step 9: Assign Super Admin role to user
        console.log('\n9️⃣  Assigning Super Admin role to user...');
        
        await UserRole.findOrCreate({
            where: {
                userId: superAdminUser.id,
                tenantId: systemTenant.id,
                role: 'SUPER_ADMIN'
            }
        });
        console.log(`   ✓ Assigned SUPER_ADMIN role`);

        // Step 10: Success summary
        console.log('\n' + '═'.repeat(80));
        console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY');
        console.log('═'.repeat(80));
        console.log('\n📊 Summary:');
        console.log(`   • Permissions created: ${MODULES.length} modules × ${ACTIONS.length} actions = ${MODULES.length * ACTIONS.length}`);
        console.log(`   • System roles: ${SYSTEM_ROLES.length}`);
        console.log(`   • Tenant-level roles: ${DEFAULT_TENANT_ROLES.length}`);
        console.log(`   • Super Admin user: ${SUPER_ADMIN_EMAIL}`);
        console.log(`   • System tenant: ${systemTenant.name}`);
        console.log('\n🔐 Super Admin Credentials:');
        console.log(`   Email:    ${SUPER_ADMIN_EMAIL}`);
        console.log(`   Password: ${SUPER_ADMIN_PASSWORD}`);
        console.log('\n⚠️  IMPORTANT:');
        console.log('   • Change the Super Admin password on first login');
        console.log('   • Do NOT use default credentials in production');
        console.log('   • Use SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars to customize');
        
        const elapsed = new Date() - startTime;
        console.log(`\n⏱️  Completed in ${elapsed}ms`);
        console.log('═'.repeat(80) + '\n');

        await sequelize.close();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ SEEDING FAILED:');
        console.error(error);
        console.log('\n' + '═'.repeat(80));
        
        try {
            await sequelize.close();
        } catch (closeError) {
            // Ignore close errors
        }
        
        process.exit(1);
    }
}

// ============================================================================
// RUN SEED
// ============================================================================

if (require.main === module) {
    seed();
}

module.exports = { seed };
