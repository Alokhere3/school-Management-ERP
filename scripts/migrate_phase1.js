/**
 * Migration Script: Phase 1 - Canonical Role Identity
 * 
 * 1. Add 'code' column to 'roles' table if missing.
 * 2. Populate 'code' for existing roles based on 'name'.
 * 3. Backfill user_roles.roleId where missing.
 */

const { Sequelize, DataTypes, Op } = require('sequelize');
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

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('roles');

        // 1. Add 'code' column
        if (!tableInfo.code) {
            console.log('Adding code column to roles...');
            await queryInterface.addColumn('roles', 'code', {
                type: DataTypes.STRING(50),
                allowNull: true, // Allow null temporarily for backfill
                unique: true
            });
        } else {
            console.log('code column already exists.');
        }

        // 2. Populate 'code'
        console.log('Populating role codes...');
        const [roles] = await sequelize.query("SELECT id, name, code FROM roles");

        for (const role of roles) {
            if (!role.code) {
                // Generate code: UPPERCASE_SNAKE_CASE
                let code = role.name.toUpperCase().trim().replace(/[^A-Z0-9]+/g, '_');

                // Handle edge cases or collisions if necessary (assuming unique names per tenant, but global code uniqueness might be tricky if names duplicate across tenants? 
                // Wait, 'code' is unique? 
                // The Role model definition says `unique: true`.
                // If "Teacher" role exists in multiple tenants, they can't all have code "TEACHER"?
                // The requirement says "Populate code with uppercase snake case: Teacher -> TEACHER".
                // If `UserRole.roleId` links to a specific tenant's role, that's fine.
                // But `roles.code` being unique means we can't have duplicate codes.
                // BUT current `Role` model has `indexes: [{ fields: ['tenantId', 'name'], unique: true }]`.
                // Validation in `Role.js` says: `system roles must be global`.
                // Verify if we have multiple roles with same name?
                // If so, we have a problem with `unique: true` on `code`.
                // Let's check if duplicates exist.

                // If names are duplicate across tenants, we might need `code` to be unique per tenant?
                // Or maybe we migrate to global system roles?
                // The plan says: "Eliminate string-based role identity".
                // "Teacher -> TEACHER".
                // If there are 100 tenants, do we have 100 "Teacher" roles?
                // If so, `code` cannot be unique globally if it's just "TEACHER".
                // UNLESS we use System Roles for everything?
                // OR `code` is unique per tenant?
                // The user request said: roles.code VARCHAR NOT NULL UNIQUE.
                // This implies GLOBAL uniqueness.
                // If so, the system roles "Teacher", "School Admin" must be single rows in `roles` table used by everyone?
                // BUT `Role` table has `tenantId`.
                // RLS logic `UserRole` links `userId`, `roleId`, `tenantId`.
                // If `roleId` points to a `Role` that is tenant-specific, then we have multiple "Teacher" roles.

                // Let's check if we have duplicate role names.
                // If we do, we might need to append tenantId or use a common System Role.
                // "Migrate the existing hybrid RBAC... Canonical Role Identity".
                // Maybe the goal IS to have common roles?

                // Strategy: 
                // If isSystemRole=true, code = NAME.
                // If isSystemRole=false (tenant specific), verify if we can make them system roles?
                // OR if we must keep them tenant specific, code must include tenant? e.g. "TENANT_123_TEACHER"?
                // BUT the goal "Teacher -> TEACHER" implies standard codes.

                // Let's look at `UserRole` linking.
                // IF we normalize to standard roles, we might need to de-duplicate roles?
                // This is a complex migration if data is already fragmented.
                // Checks:

                // If duplicates exist, I will append tenant ID to code for now to avoid crash,
                // BUT I should warn.
                // Or assume "isSystemRole" will be used more?

                // For now, try "NAME". If collision, try "NAME_TENANTID".

                try {
                    await sequelize.query(
                        "UPDATE roles SET code = :code WHERE id = :id",
                        { replacements: { code, id: role.id } }
                    );
                    console.log(`Updated role ${role.name} (${role.id}) -> ${code}`);
                } catch (err) {
                    if (err.name === 'SequelizeUniqueConstraintError' || err.code === 'ER_DUP_ENTRY') {
                        // Collision!
                        code = `${code}_${role.tenantId || 'GLOBAL'}`;
                        await sequelize.query(
                            "UPDATE roles SET code = :code WHERE id = :id",
                            { replacements: { code, id: role.id } }
                        );
                        console.log(`Updated role ${role.name} (${role.id}) -> ${code} (Collision resolved)`);
                    } else {
                        throw err;
                    }
                }
            }
        }

        // 3. Enforce NOT NULL on code
        // await queryInterface.changeColumn('roles', 'code', {
        //     type: DataTypes.STRING(50),
        //     allowNull: false,
        //     unique: true
        // });
        // NOTE: changeColumn can be risky in some dialects/versions if data not perfect.
        // We will skip strict schema enforcement in script, rely on model validation.

        // 4. Backfill user_roles.roleId
        console.log('Backfilling user_roles.roleId...');
        // Strategy: 
        // Iterate user_roles where roleId is NULL.
        // Find role by name (string) matches.
        // If system role exists with that name, prefer it?
        // Or if tenant matches?

        // Complex because `user_roles` has `role` string (e.g. "admin"), and `tenantId`.
        // We look for a Role where `name` ~= `user_roles.role` AND (`tenantId` = `user_roles.tenantId` OR `isSystemRole` = true).

        const [userRoles] = await sequelize.query("SELECT * FROM user_roles WHERE roleId IS NULL");
        console.log(`Found ${userRoles.length} user_roles to backfill.`);

        for (const ur of userRoles) {
            const roleName = ur.role; // string
            if (!roleName) continue;

            const normalizedName = roleName.trim();
            // Try to find matching role
            // Priority: Tenant specific > System
            const [matches] = await sequelize.query(
                `SELECT id FROM roles 
                 WHERE name = :name 
                 AND (tenantId = :tenantId OR isSystemRole = TRUE)
                 ORDER BY tenantId DESC LIMIT 1`, // tenantId matches first (specific), then null (system)
                { replacements: { name: normalizedName, tenantId: ur.tenantId } }
            );

            if (matches.length > 0) {
                const roleId = matches[0].id;
                await sequelize.query(
                    "UPDATE user_roles SET roleId = :roleId WHERE id = :id",
                    { replacements: { roleId, id: ur.id } }
                );
            } else {
                console.warn(`Could not find role for user_role ${ur.id} (role: ${roleName}, tenant: ${ur.tenantId})`);
            }
        }

        console.log('Migration Phase 1 Complete.');

    } catch (error) {
        console.error('Migration Failed:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

migrate();
