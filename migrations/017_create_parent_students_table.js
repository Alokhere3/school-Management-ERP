'use strict';

/**
 * Migration: Create ParentStudents Linker Table
 * 
 * Creates the parent_students table to link parents to students with specific relationships.
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Check if table already exists
            const tables = await queryInterface.showAllTables();
            if (tables.includes('parent_students')) {
                console.log('  ℹ️ ParentStudents table already exists, skipping creation');
                await transaction.commit();
                return;
            }
            
            await queryInterface.createTable('parent_students', {
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
                parentId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'parents',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                studentId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'students',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                relation: {
                    type: Sequelize.ENUM('Father', 'Mother', 'Guardian', 'Grandparent', 'Other'),
                    allowNull: false
                },
                isPrimary: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false,
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
            await queryInterface.addIndex('parent_students', ['tenantId', 'studentId'], {
                name: 'parent_students_tenantId_studentId',
                transaction
            });
            
            await queryInterface.addIndex('parent_students', ['tenantId', 'parentId'], {
                name: 'parent_students_tenantId_parentId',
                transaction
            });
            
            // Add unique constraint
            await queryInterface.addIndex('parent_students', ['tenantId', 'parentId', 'studentId'], {
                unique: true,
                name: 'uq_tenant_parent_student',
                transaction
            });
            
            await transaction.commit();
            console.log('✅ ParentStudents table created successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error creating parent_students table:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            await queryInterface.dropTable('parent_students', { transaction });
            await transaction.commit();
            console.log('✅ ParentStudents table dropped successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error dropping parent_students table:', error.message);
            throw error;
        }
    }
};


