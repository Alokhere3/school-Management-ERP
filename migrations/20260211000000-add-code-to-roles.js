'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Check if 'code' column exists
        const tableInfo = await queryInterface.describeTable('roles');

        if (!tableInfo.code) {
            // Add 'code' column allowing NULL initially
            await queryInterface.addColumn('roles', 'code', {
                type: Sequelize.STRING(50),
                allowNull: true // Allow null temporarily for population
            });
        }

        // 2. Populate 'code' for existing roles
        const roles = await queryInterface.sequelize.query(
            `SELECT id, name FROM roles`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        for (const role of roles) {
            // Generate code: UPPERCASE_SNAKE_CASE
            // Append 4 chars of ID to ensure uniqueness across tenants if global unique constraint exists
            let code = role.name
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '_')
                .replace(/_+/g, '_') // collapse multiple underscores
                .replace(/^_|_$/g, ''); // remove leading/trailing underscores

            code = `${code}_${role.id.substring(0, 5).toUpperCase()}`;

            // Ensure code is not empty (fallback to ID if name is weird)
            if (!code) code = `ROLE_${role.id.substring(0, 8).toUpperCase()}`;

            // Update the record
            await queryInterface.sequelize.query(
                `UPDATE roles SET code = :code WHERE id = :id`,
                {
                    replacements: { code, id: role.id },
                    type: Sequelize.QueryTypes.UPDATE
                }
            );
        }

        // 3. Change column to NOT NULL and add Unique constraint
        // Note: We might run into issues if duplicate codes are generated (e.g. "Teacher" and "TEACHER" or different tenants having same role name)
        // Since tenants are separated, we probably want unique per tenant?
        // But the model said unique: true (global). 
        // Let's stick to the model definition for now but be careful.
        // If we have "Teacher" in Tenant A and "Teacher" in Tenant B, they will generate same code "TEACHER".
        // If unique is global, this will fail.

        // Let's check if the model really enforces global uniqueness.
        // The previous analysis of Role.js showed:
        // code: { unique: true }
        // This IS global. This is bad for multi-tenancy if multiple tenants have "School Admin".
        // However, the `roles` table usually has `tenantId`.
        // If I add a unique constraint on `code`, it will break for multiple tenants.
        // BUT, the user said "there is no need of role code. generate it from backend."
        // If I make it unique per tenant, that's better.
        // Let's check `Role.js` again.
        // It has `indexes: [ { fields: ['tenantId', 'name'], unique: true } ]`.
        // If I add `code` and make it unique, it must be `unique: true` across the table.

        // CRITICAL DECISION:
        // If I enforce `unique: true` on `code` column globally, existing data with same role names in different tenants will fail migration.
        // I should probably make it unique per tenant `(tenantId, code)` OR just not enforce unique constraint on DB level for now,
        // relying on the unique `(tenantId, name)` index to effectively enforce unique codes (since code is derived from name).

        // Changing plan: I will set allowNull: false, but NOT add a unique index on 'code' alone from the migration.
        // I will rely on the existing composite index or add a new composite index `(tenantId, code)`.

        // 3. Change column to NOT NULL and add Unique constraint
        // Only if we added it or if it accepts nulls (to enforce constraint)
        // We can just try to change it.

        try {
            await queryInterface.changeColumn('roles', 'code', {
                type: Sequelize.STRING(50),
                allowNull: false
            });
        } catch (error) {
            console.log('Could not change column code to NOT NULL (might already be):', error.message);
        }

        // Optional: Add index for performance, but careful with uniqueness
        try {
            await queryInterface.addIndex('roles', ['tenantId', 'code'], {
                unique: true,
                name: 'roles_tenantId_code_unique'
            });
        } catch (error) {
            if (!error.message.includes('Duplicate key name') && !error.message.includes('already exists')) {
                console.log('Could not add index roles_tenantId_code_unique:', error.message);
            }
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('roles', 'roles_tenantId_code_unique');
        await queryInterface.removeColumn('roles', 'code');
    }
};
