const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: true, // NULL = system/super-admin role
        references: {
            model: 'tenants',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        // Examples: "School Admin", "Teacher", "Super Admin", "Principal", etc.
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    isSystemRole: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        // true = Super Admin, Support Engineer (cross-tenant)
        // false = School Admin, Teacher, etc. (tenant-scoped)
    }
}, {
    tableName: 'roles',
    timestamps: true,
    indexes: [
        { fields: ['tenantId', 'name'], unique: true }
    ]
});

module.exports = Role;
