'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Fetch all UserRoles where roleId is NULL
        const userRoles = await queryInterface.sequelize.query(
            `SELECT id, role, tenantId FROM user_roles WHERE roleId IS NULL`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        console.log(`Found ${userRoles.length} UserRole records to backfill.`);

        if (userRoles.length === 0) return;

        // 2. Fetch all Roles to match against
        const roles = await queryInterface.sequelize.query(
            `SELECT id, name, code, tenantId, isSystemRole FROM roles`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        // Helper to find matching role
        const findRole = (ur) => {
            const urRole = ur.role; // e.g., "TEACHER" or "SCHOOL_ADMIN"
            if (!urRole) return null;

            // Try matching by Code (exact match)
            // Filter by tenant scope
            const match = roles.find(r => {
                const tenantMatch = (r.tenantId === ur.tenantId) || r.isSystemRole;
                return tenantMatch && (r.code === urRole || r.name.toUpperCase().replace(/[^A-Z0-9]/g, '_') === urRole);
            });

            return match;
        };

        let updatedCount = 0;
        const errors = [];

        for (const ur of userRoles) {
            const role = findRole(ur);
            if (role) {
                try {
                    await queryInterface.sequelize.query(
                        `UPDATE user_roles SET roleId = :roleId WHERE id = :id`,
                        {
                            replacements: { roleId: role.id, id: ur.id },
                            type: Sequelize.QueryTypes.UPDATE
                        }
                    );
                    updatedCount++;
                } catch (err) {
                    console.error(`Failed to update UserRole ${ur.id}:`, err.message);
                    errors.push(ur.id);
                }
            } else {
                console.warn(`No matching Role found for UserRole ${ur.id} (Role: ${ur.role}, Tenant: ${ur.tenantId})`);
            }
        }

        console.log(`Backfill complete. Updated: ${updatedCount}, Failed: ${errors.length}, Skipped/NoMatch: ${userRoles.length - updatedCount - errors.length}`);
    },

    down: async (queryInterface, Sequelize) => {
        // No easy way to undo specific updates without backup.
        // We could set roleId = NULL, but that might destroy valid data.
        // So we leave it as no-op or specific revert if needed.
        // For safety, we'll strip roleIds only where they might have been adding constraints, but here we just added data.
        console.log('Down migration: No action taken to preserve data integrity.');
    }
};
