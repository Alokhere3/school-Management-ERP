/**
 * Assign Roles to Existing Users
 * 
 * This script helps assign RBAC roles to users that already exist
 * in the database. You can customize it for your needs.
 * 
 * Usage:
 * node scripts/assignRolesToUsers.js
 */

require('dotenv').config();

const { sequelize } = require('../config/database');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');

const DEFAULT_ROLE_ASSIGNMENTS = {
    'admin': 'School Admin',
    'user': 'Student'
};

async function assignRolesToUsers() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // Get all tenants
        const tenants = await Tenant.findAll();
        if (tenants.length === 0) {
            console.log('⚠️  No tenants found. Create tenants first.');
            process.exit(0);
        }

        // Get all users without roles
        const users = await User.findAll({
            raw: true
        });

        console.log(`\n📋 Found ${users.length} users, ${tenants.length} tenants\n`);

        let assignedCount = 0;

        for (const user of users) {
            // Check if user already has roles
            const existingRoles = await UserRole.findAll({
                where: { userId: user.id }
            });

            if (existingRoles.length > 0) {
                console.log(`⏭️  User ${user.email}: Already has ${existingRoles.length} role(s)`);
                continue;
            }

            // Determine role based on user.role field
            const roleName = DEFAULT_ROLE_ASSIGNMENTS[user.role] || 'Student';

            // Get or create role
            const role = await Role.findOne({
                where: { name: roleName, tenantId: null }
            });

            if (!role) {
                console.warn(`⚠️  Role not found: ${roleName}. Skipping user ${user.email}`);
                continue;
            }

            // Assign role to user in their tenant
            if (user.tenantId) {
                await UserRole.create({
                    userId: user.id,
                    roleId: role.id,
                    tenantId: user.tenantId
                });
                console.log(`✅ User ${user.email}: Assigned ${roleName}`);
                assignedCount++;
            } else {
                console.warn(`⚠️  User ${user.email}: No tenant assigned. Skipping.`);
            }
        }

        console.log(`\n✅ Successfully assigned roles to ${assignedCount} users`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

assignRolesToUsers();
