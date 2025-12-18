'use strict';

/**
 * Migration: Create Parents Table
 * 
 * Creates the parents table for guardian information with optional login linkage.
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Check if table already exists
            const tables = await queryInterface.showAllTables();
            if (tables.includes('parents')) {
                console.log('  ℹ️ Parents table already exists, skipping creation');
                await transaction.commit();
                return;
            }
            
            await queryInterface.createTable('parents', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4,
                    primaryKey: true
                },
                tenantId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'tenants',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                userId: {
                    type: Sequelize.UUID,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                name: {
                    type: Sequelize.STRING(255),
                    allowNull: false
                },
                email: {
                    type: Sequelize.STRING(255),
                    allowNull: true
                },
                phone: {
                    type: Sequelize.STRING(20),
                    allowNull: false
                },
                relation: {
                    type: Sequelize.STRING(50),
                    allowNull: false
                },
                gender: {
                    type: Sequelize.ENUM('Male', 'Female', 'Other'),
                    allowNull: true
                },
                occupation: {
                    type: Sequelize.STRING(100),
                    allowNull: true
                },
                address: {
                    type: Sequelize.TEXT,
                    allowNull: true
                },
                status: {
                    type: Sequelize.ENUM('active', 'inactive'),
                    defaultValue: 'active',
                    allowNull: false
                },
                createdAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                },
                updatedAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
                }
            }, { transaction });
            
            // Add indexes
            await queryInterface.addIndex('parents', ['tenantId', 'email'], {
                name: 'parents_tenantId_email',
                transaction
            });
            
            await queryInterface.addIndex('parents', ['tenantId', 'phone'], {
                name: 'parents_tenantId_phone',
                transaction
            });
            
            await queryInterface.addIndex('parents', ['tenantId', 'userId'], {
                name: 'parents_tenantId_userId',
                transaction
            });
            
            await queryInterface.addIndex('parents', ['tenantId', 'status'], {
                name: 'parents_tenantId_status',
                transaction
            });
            
            await transaction.commit();
            console.log('✅ Parents table created successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error creating parents table:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            await queryInterface.dropTable('parents', { transaction });
            await transaction.commit();
            console.log('✅ Parents table dropped successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error dropping parents table:', error.message);
            throw error;
        }
    }
};


