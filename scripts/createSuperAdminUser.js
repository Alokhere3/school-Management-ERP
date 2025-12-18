/**
 * Create a Super Admin user in the database
 * 
 * Run: node scripts/createSuperAdminUser.js
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');

async function createSuperAdmin() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // Check if system tenant exists
        let systemTenant = await Tenant.findOne({ where: { slug: 'system' } });
        
        if (!systemTenant) {
            console.log('📝 Creating system tenant...');
            systemTenant = await Tenant.create({
                name: 'System',
                slug: 'system'
            });
            console.log('✅ System tenant created');
        } else {
            console.log('✅ System tenant already exists');
        }

        // Get or create Super Admin role
        const superAdminRole = await Role.findOne({ 
            where: { name: 'Super Admin', isSystemRole: true } 
        });

        if (!superAdminRole) {
            console.error('❌ Super Admin role not found. Please run: node scripts/seedRBAC.js');
            process.exit(1);
        }

        console.log('✅ Super Admin role found');

        // Check if super admin user already exists
        const existingAdmin = await User.findOne({ 
            where: { email: 'superadmin@system.local' } 
        });

        if (existingAdmin) {
            console.log('⚠️  Super Admin user already exists with email: superadmin@system.local');
            console.log('   User ID:', existingAdmin.id);
            console.log('   Tenant ID:', existingAdmin.tenantId);
            
            // Check if they have the Super Admin role
            const userRole = await UserRole.findOne({
                where: {
                    userId: existingAdmin.id,
                    roleId: superAdminRole.id
                }
            });

            if (!userRole) {
                console.log('📝 Assigning Super Admin role...');
                await UserRole.create({
                    userId: existingAdmin.id,
                    roleId: superAdminRole.id,
                    tenantId: systemTenant.id
                });
                console.log('✅ Super Admin role assigned');
            } else {
                console.log('✅ Super Admin role already assigned');
            }

            console.log('\n✅ Super Admin setup complete!');
            process.exit(0);
        }

        // Create super admin user
        console.log('📝 Creating Super Admin user...');
        const hashedPassword = await bcrypt.hash('SuperAdmin@123', 12);
        
        const superAdmin = await User.create({
            tenantId: systemTenant.id,
            email: 'superadmin@system.local',
            password: hashedPassword,
            role: 'admin'
        });

        console.log('✅ Super Admin user created');
        console.log('   Email: superadmin@system.local');
        console.log('   Password: SuperAdmin@123 (change this immediately!)');
        console.log('   User ID:', superAdmin.id);

        // Assign Super Admin role
        console.log('📝 Assigning Super Admin role...');
        await UserRole.create({
            userId: superAdmin.id,
            roleId: superAdminRole.id,
            tenantId: systemTenant.id
        });

        console.log('✅ Super Admin role assigned');

        console.log('\n✅ Super Admin user created successfully!');
        console.log('\nCredentials:');
        console.log('  Email: superadmin@system.local');
        console.log('  Password: SuperAdmin@123');
        console.log('\n⚠️  IMPORTANT: Change the password immediately after first login!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to create Super Admin:', error.message || error);
        process.exit(1);
    }
}

createSuperAdmin();
