'use strict';

/**
 * Migration: Update UserRoles Table - Change from roleId to role ENUM
 * 
 * Changes:
 * - Remove roleId foreign key column
 * - Add role ENUM column
 * - Update indexes
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            const tableDescription = await queryInterface.describeTable('user_roles');
            
            // Check if role column already exists
            if (!tableDescription.role) {
                // Add role ENUM column
                await queryInterface.addColumn('user_roles', 'role', {
                    type: Sequelize.ENUM(
                        'SUPER_ADMIN',
                        'SCHOOL_ADMIN',
                        'TEACHER',
                        'STAFF',
                        'STUDENT',
                        'PARENT',
                        'ACCOUNTANT',
                        'LIBRARIAN',
                        'ADMIN'
                    ),
                    allowNull: false
                }, { transaction });
                console.log('  ✓ Added role ENUM column');
                
                // Migrate existing data: try to map roleId to role name
                // This is a best-effort migration - may need manual intervention
                try {
                    const [roles] = await queryInterface.sequelize.query(
                        `SELECT id, name FROM roles`,
                        { transaction }
                    );
                    
                    const roleMap = {};
                    roles.forEach(r => {
                        // Map role name to ENUM value
                        const enumValue = r.name.toUpperCase().replace(/\s+/g, '_');
                        roleMap[r.id] = enumValue;
                    });
                    
                    // Update user_roles with role values
                    for (const [roleId, enumValue] of Object.entries(roleMap)) {
                        await queryInterface.sequelize.query(
                            `UPDATE user_roles SET role = ? WHERE roleId = ?`,
                            {
                                replacements: [enumValue, roleId],
                                transaction
                            }
                        );
                    }
                    
                    console.log('  ✓ Migrated existing role data');
                } catch (migrateError) {
                    console.warn('  ⚠️ Could not migrate existing role data:', migrateError.message);
                    console.warn('  ⚠️ You may need to manually update user_roles.role values');
                }
            }
            
            // Remove roleId column and foreign key if it exists
            if (tableDescription.roleId) {
                // Remove foreign key constraint first
                try {
                    const [constraints] = await queryInterface.sequelize.query(
                        `SELECT CONSTRAINT_NAME 
                         FROM information_schema.KEY_COLUMN_USAGE 
                         WHERE TABLE_SCHEMA = DATABASE() 
                         AND TABLE_NAME = 'user_roles' 
                         AND COLUMN_NAME = 'roleId' 
                         AND REFERENCED_TABLE_NAME IS NOT NULL`
                    );
                    
                    for (const constraint of constraints) {
                        await queryInterface.sequelize.query(
                            `ALTER TABLE user_roles DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`,
                            { transaction }
                        );
                    }
                } catch (e) {
                    console.log('  ℹ️ Could not remove roleId foreign key (may not exist)');
                }
                
                // Remove index on roleId
                try {
                    await queryInterface.removeIndex('user_roles', ['roleId'], { transaction });
                } catch (e) {
                    // Ignore if doesn't exist
                }
                
                // Remove roleId column
                await queryInterface.removeColumn('user_roles', 'roleId', { transaction });
                console.log('  ✓ Removed roleId column');
            }
            
            // Update indexes
            // Remove old roleId index if exists
            try {
                await queryInterface.removeIndex('user_roles', ['roleId', 'tenantId'], { transaction });
            } catch (e) {
                // Ignore if doesn't exist
            }
            
            // Add new indexes
            const [roleIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM user_roles WHERE Key_name = 'user_roles_tenantId_role'`
            );
            if (roleIndexes.length === 0) {
                await queryInterface.addIndex('user_roles', ['tenantId', 'role'], {
                    name: 'user_roles_tenantId_role',
                    transaction
                });
                console.log('  ✓ Added tenantId + role index');
            }
            
            // Update unique constraint
            const [uniqueIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM user_roles WHERE Key_name = 'uq_user_tenant_role'`
            );
            if (uniqueIndexes.length === 0) {
                // Remove old unique if exists
                try {
                    await queryInterface.removeIndex('user_roles', ['userId', 'roleId', 'tenantId'], { transaction });
                } catch (e) {
                    // Ignore
                }
                
                await queryInterface.addIndex('user_roles', ['userId', 'tenantId', 'role'], {
                    unique: true,
                    name: 'uq_user_tenant_role',
                    transaction
                });
                console.log('  ✓ Added unique constraint on userId + tenantId + role');
            }
            
            await transaction.commit();
            console.log('✅ UserRoles table updated successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error updating user_roles table:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Add roleId back
            await queryInterface.addColumn('user_roles', 'roleId', {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'roles',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            }, { transaction });
            
            // Remove role column
            await queryInterface.removeColumn('user_roles', 'role', { transaction });
            
            // Restore indexes
            await queryInterface.addIndex('user_roles', ['roleId'], { transaction });
            await queryInterface.addIndex('user_roles', ['roleId', 'tenantId'], { transaction });
            
            await transaction.commit();
            console.log('✅ UserRoles table reverted successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error reverting user_roles table:', error.message);
            throw error;
        }
    }
};


