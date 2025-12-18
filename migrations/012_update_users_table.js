'use strict';

/**
 * Migration: Update Users Table for New Auth System
 * 
 * Changes:
 * - Rename password to passwordHash
 * - Add mustChangePassword, lastPasswordChangedAt, status, phone
 * - Change email unique constraint to tenant-scoped (tenantId + email)
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Check if passwordHash column exists (migration already run)
            const [columns] = await queryInterface.sequelize.query(
                `SHOW COLUMNS FROM users LIKE 'passwordHash'`
            );
            
            if (columns.length === 0) {
                // Rename password to passwordHash
                await queryInterface.renameColumn('users', 'password', 'passwordHash', { transaction });
                console.log('  ✓ Renamed password to passwordHash');
            }
            
            // Add new columns if they don't exist
            const tableDescription = await queryInterface.describeTable('users');
            
            if (!tableDescription.mustChangePassword) {
                await queryInterface.addColumn('users', 'mustChangePassword', {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false,
                    allowNull: false
                }, { transaction });
                console.log('  ✓ Added mustChangePassword column');
            }
            
            if (!tableDescription.lastPasswordChangedAt) {
                await queryInterface.addColumn('users', 'lastPasswordChangedAt', {
                    type: Sequelize.DATE,
                    allowNull: true
                }, { transaction });
                console.log('  ✓ Added lastPasswordChangedAt column');
            }
            
            if (!tableDescription.status) {
                await queryInterface.addColumn('users', 'status', {
                    type: Sequelize.ENUM('active', 'inactive', 'suspended'),
                    defaultValue: 'active',
                    allowNull: false
                }, { transaction });
                console.log('  ✓ Added status column');
            }
            
            if (!tableDescription.phone) {
                await queryInterface.addColumn('users', 'phone', {
                    type: Sequelize.STRING(20),
                    allowNull: true
                }, { transaction });
                console.log('  ✓ Added phone column');
            }
            
            // Update email unique constraint to tenant-scoped
            // First, check if old unique constraint exists
            const [indexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM users WHERE Key_name = 'users_email_unique' OR Column_name = 'email'`
            );
            
            const hasEmailUnique = indexes.some(idx => idx.Key_name === 'users_email_unique' || (idx.Non_unique === 0 && idx.Column_name === 'email'));
            
            if (hasEmailUnique) {
                // Remove old unique constraint on email
                try {
                    await queryInterface.removeIndex('users', 'users_email_unique', { transaction });
                } catch (e) {
                    // Try alternative index name
                    try {
                        await queryInterface.removeIndex('users', ['email'], { transaction });
                    } catch (e2) {
                        console.log('  ℹ️ Could not remove old email unique constraint (may not exist)');
                    }
                }
            }
            
            // Add tenant-scoped unique constraint
            const [tenantEmailIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM users WHERE Key_name = 'uq_tenant_email'`
            );
            
            if (tenantEmailIndexes.length === 0) {
                await queryInterface.addIndex('users', ['tenantId', 'email'], {
                    unique: true,
                    name: 'uq_tenant_email',
                    transaction
                });
                console.log('  ✓ Added tenant-scoped email unique constraint');
            }
            
            // Add other indexes
            const [phoneIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM users WHERE Key_name = 'users_tenantId_phone'`
            );
            if (phoneIndexes.length === 0) {
                await queryInterface.addIndex('users', ['tenantId', 'phone'], {
                    name: 'users_tenantId_phone',
                    transaction
                });
                console.log('  ✓ Added tenantId + phone index');
            }
            
            const [statusIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM users WHERE Key_name = 'users_tenantId_status'`
            );
            if (statusIndexes.length === 0) {
                await queryInterface.addIndex('users', ['tenantId', 'status'], {
                    name: 'users_tenantId_status',
                    transaction
                });
                console.log('  ✓ Added tenantId + status index');
            }
            
            await transaction.commit();
            console.log('✅ Users table updated successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error updating users table:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Reverse changes
            const tableDescription = await queryInterface.describeTable('users');
            
            if (tableDescription.passwordHash) {
                await queryInterface.renameColumn('users', 'passwordHash', 'password', { transaction });
            }
            
            if (tableDescription.mustChangePassword) {
                await queryInterface.removeColumn('users', 'mustChangePassword', { transaction });
            }
            
            if (tableDescription.lastPasswordChangedAt) {
                await queryInterface.removeColumn('users', 'lastPasswordChangedAt', { transaction });
            }
            
            if (tableDescription.status) {
                await queryInterface.removeColumn('users', 'status', { transaction });
            }
            
            if (tableDescription.phone) {
                await queryInterface.removeColumn('users', 'phone', { transaction });
            }
            
            // Remove tenant-scoped unique and restore email unique
            try {
                await queryInterface.removeIndex('users', 'uq_tenant_email', { transaction });
            } catch (e) {
                // Ignore if doesn't exist
            }
            
            await queryInterface.addIndex('users', ['email'], {
                unique: true,
                name: 'users_email_unique',
                transaction
            });
            
            await transaction.commit();
            console.log('✅ Users table reverted successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error reverting users table:', error.message);
            throw error;
        }
    }
};


