const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserRole = sequelize.define('UserRole', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' }
    },
    roleId: {
        type: DataTypes.UUID,
        allowNull: true, // Should be false eventually, but true for migration
        references: { model: 'roles', key: 'id' }
    },
    role: {
        type: DataTypes.STRING, // Changed from ENUM to STRING to support legacy values + custom role names if needed
        allowNull: true
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
}, {
    tableName: 'user_roles',
    timestamps: true,
    indexes: [
        { fields: ['userId', 'tenantId'] },
        { fields: ['tenantId', 'role'] },
        { unique: true, fields: ['userId', 'tenantId', 'role'], name: 'uq_user_tenant_role' }
    ]
});

module.exports = UserRole;
