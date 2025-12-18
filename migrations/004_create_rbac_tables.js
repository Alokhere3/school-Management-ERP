/**
 * Migration: Add RBAC tables (roles, permissions, role_permissions, user_roles)
 */
const { sequelize } = require('../config/database');

module.exports = {
    up: async () => {
        const queryInterface = sequelize.getQueryInterface();
        const transaction = await sequelize.transaction();
        
        try {
            // Check if roles table already exists
            const tables = await queryInterface.showAllTables();
            if (tables.includes('roles')) {
                console.log('✓ RBAC tables already exist, skipping creation');
                await transaction.commit();
                return;
            }

            // Create roles table
            await queryInterface.createTable('roles', {
                id: {
                    type: sequelize.Sequelize.UUID,
                    defaultValue: sequelize.Sequelize.UUIDV4,
                    primaryKey: true
                },
                tenantId: {
                    type: sequelize.Sequelize.UUID,
                    allowNull: true,
                    references: {
                        model: 'tenants',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                name: {
                    type: sequelize.Sequelize.STRING(100),
                    allowNull: false
                },
                description: {
                    type: sequelize.Sequelize.TEXT,
                    allowNull: true
                },
                isSystemRole: {
                    type: sequelize.Sequelize.BOOLEAN,
                    defaultValue: false
                },
                createdAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.fn('now')
                },
                updatedAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.fn('now')
                }
            }, { transaction });

            await queryInterface.addIndex('roles', ['tenantId', 'name'], {
                unique: true,
                transaction
            });

            // Create permissions table
            await queryInterface.createTable('permissions', {
                id: {
                    type: sequelize.Sequelize.UUID,
                    defaultValue: sequelize.Sequelize.UUIDV4,
                    primaryKey: true
                },
                resource: {
                    type: sequelize.Sequelize.STRING(100),
                    allowNull: false
                },
                action: {
                    type: sequelize.Sequelize.ENUM('create', 'read', 'update', 'delete', 'export'),
                    allowNull: false
                },
                description: {
                    type: sequelize.Sequelize.TEXT,
                    allowNull: true
                },
                createdAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.fn('now')
                },
                updatedAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.fn('now')
                }
            }, { transaction });

            await queryInterface.addIndex('permissions', ['resource', 'action'], {
                unique: true,
                transaction
            });

            // Create role_permissions join table
            await queryInterface.createTable('role_permissions', {
                id: {
                    type: sequelize.Sequelize.UUID,
                    defaultValue: sequelize.Sequelize.UUIDV4,
                    primaryKey: true
                },
                roleId: {
                    type: sequelize.Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'roles',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                permissionId: {
                    type: sequelize.Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'permissions',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                level: {
                    type: sequelize.Sequelize.ENUM('none', 'read', 'limited', 'full'),
                    defaultValue: 'none'
                },
                createdAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.fn('now')
                },
                updatedAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.fn('now')
                }
            }, { transaction });

            await queryInterface.addIndex('role_permissions', ['roleId', 'permissionId'], {
                unique: true,
                transaction
            });

            // Create user_roles join table
            await queryInterface.createTable('user_roles', {
                id: {
                    type: sequelize.Sequelize.UUID,
                    defaultValue: sequelize.Sequelize.UUIDV4,
                    primaryKey: true
                },
                userId: {
                    type: sequelize.Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                roleId: {
                    type: sequelize.Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'roles',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                tenantId: {
                    type: sequelize.Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'tenants',
                        key: 'id'
                    },
                    onDelete: 'CASCADE'
                },
                createdAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.fn('now')
                },
                updatedAt: {
                    type: sequelize.Sequelize.DATE,
                    allowNull: false,
                    defaultValue: sequelize.Sequelize.fn('now')
                }
            }, { transaction });

            await queryInterface.addIndex('user_roles', ['userId', 'tenantId'], {
                transaction
            });
            await queryInterface.addIndex('user_roles', ['roleId', 'tenantId'], {
                transaction
            });

            await transaction.commit();
            console.log('✓ Migration 004 completed successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Migration 004 failed:', error.message);
            throw error;
        }
    }
};

