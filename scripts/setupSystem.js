/**
 * System Setup Script
 * 
 * This script initializes the entire system in the correct order:
 * 1. Seeds RBAC roles, permissions, and mappings
 * 2. Creates the super admin user
 * 
 * Run: node scripts/setupSystem.js
 */

require('dotenv').config();

const { sequelize } = require('../config/database');

async function runSetup() {
    try {
        console.log('\n========================================');
        console.log('  SCHOOL ERP - SYSTEM SETUP');
        console.log('========================================\n');

        // Step 1: Seed RBAC
        console.log('📋 Step 1: Seeding RBAC roles, permissions, and mappings...\n');
        try {
            require('./seedRBAC');
        } catch (err) {
            console.error('❌ Error during RBAC seed:', err.message);
            process.exit(1);
        }

        // Brief pause to ensure seed completes
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Create super admin user
        console.log('\n📋 Step 2: Creating super admin user...\n');
        try {
            require('./CreateAdminWithAlok');
        } catch (err) {
            console.error('❌ Error during super admin creation:', err.message);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

runSetup();
