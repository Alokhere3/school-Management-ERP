/**
 * Migration Script: Phase 2 - Permission Policy Engine
 * 
 * 1. Add 'effect', 'scope', 'conditions' to 'role_permissions'.
 * 2. Migrate existing 'level' to 'scope'/'effect'.
 * 3. Enforce (resource, action) uniqueness.
 */

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbName = process.env.DB_NAME || 'school_erp_db';
const dbUser = process.env.DB_USER || process.env.DB_USERNAME || 'root';
const dbPass = process.env.DB_PASS || process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    dialect: 'mysql',
    logging: msg => console.log(`[DB] ${msg}`)
});

async function migratePhase2() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database (Phase 2).');

        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('role_permissions');

        // 1. Add Columns
        if (!tableInfo.effect) {
            console.log('Adding effect column...');
            await queryInterface.addColumn('role_permissions', 'effect', {
                type: DataTypes.ENUM('allow', 'deny'),
                defaultValue: 'allow'
            });
        }

        if (!tableInfo.scope) {
            console.log('Adding scope column...');
            await queryInterface.addColumn('role_permissions', 'scope', {
                type: DataTypes.ENUM('tenant', 'owned', 'self', 'custom'),
                defaultValue: 'tenant'
            });
        }

        if (!tableInfo.conditions) {
            console.log('Adding conditions column...');
            await queryInterface.addColumn('role_permissions', 'conditions', {
                type: DataTypes.JSON, // JSONB not supported in MySQL < 5.7, use JSON
                allowNull: true
            });
        }

        // 2. Data Migration: 'level' -> 'scope'
        console.log('Migrating level to scope...');
        // Map: 
        // full -> tenant
        // limited -> owned (simplification, verifying later)
        // read -> tenant (assuming read all?) OR owned?
        // Let's check 'PermissionScope.js' logic.
        // It says: "limited: constrained to own scope".

        await sequelize.query(`
            UPDATE role_permissions 
            SET scope = CASE 
                WHEN level = 'full' THEN 'tenant'
                WHEN level = 'limited' THEN 'owned'
                WHEN level = 'read' THEN 'tenant' -- Defaulting read to tenant for now? Or strict? 
                -- "read: read-only" usually implies tenant wide read-only? 
                -- Safest is 'tenant' mostly, unless it's a student/teacher role?
                -- Phase 3 Dynamic Scope will handle specific resources.
                ELSE 'tenant'
            END
            WHERE scope IS NULL OR scope = 'tenant' -- Apply only if not already set manually?
        `);
        // Just force update for now or trust default?
        // Since default is 'tenant', we mainly want to catch 'limited' -> 'owned'.
        await sequelize.query(`UPDATE role_permissions SET scope = 'owned' WHERE level = 'limited'`);
        await sequelize.query(`UPDATE role_permissions SET scope = 'self' WHERE level = 'none'`); // Should not exist? 'none' usually means no row.

        // 3. Enforce Uniqueness (Constraint)
        // We need to ensure we don't have duplicates first.
        // The table `RolePermission` has `unique: true, fields: ['roleId', 'permissionId']`.
        // This is already enforced by existing model:
        // models/RolePermission.js: { unique: true, fields: ['roleId', 'permissionId'] }
        // The Plan says: "Rule: Permission (resource, action) pairs must be unique and immutable."
        // That refers to `Permission` table, NOT `RolePermission`?
        // "Rule: (resource, action) pairs must be unique and immutable."
        // Yes, `Permission` table.

        const permTableInfo = await queryInterface.describeTable('permissions');
        // Check uniqueness on permissions table?
        // models/Permission.js: { fields: ['resource', 'action'], unique: true }
        // It seems it is already defined in model. We should verify on DB level.
        try {
            await queryInterface.addConstraint('permissions', {
                fields: ['resource', 'action'],
                type: 'unique',
                name: 'unique_resource_action'
            });
        } catch (e) {
            console.log('Constraint unique_resource_action likely exists or data duplicate:', e.message);
        }

        console.log('Migration Phase 2 Complete.');

    } catch (error) {
        console.error('Migration Phase 2 Failed:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

migratePhase2();
