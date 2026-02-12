const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    roleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'roles',
            key: 'id'
        }
    },
    permissionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'permissions',
            key: 'id'
        }
    },
    effect: {
        type: DataTypes.ENUM('allow', 'deny'),
        defaultValue: 'allow'
    },
    scope: {
        type: DataTypes.ENUM('tenant', 'owned', 'self', 'custom'),
        defaultValue: 'tenant'
    },
    conditions: {
        type: DataTypes.JSON, // JSONB in Postgres, JSON in MySQL 5.7+
        allowNull: true
    },
    // DEPRECATED: level (kept for backward compatibility during migration if needed, but should not be used)
    level: {
        type: DataTypes.ENUM('none', 'read', 'limited', 'full'),
        defaultValue: 'none'
    }
}, {
    tableName: 'role_permissions',
    timestamps: true,
    indexes: [
        { fields: ['roleId'] }, // For permission checks (most common query)
        { fields: ['permissionId'] }, // For reverse lookups
        { unique: true, fields: ['roleId', 'permissionId'] } // Prevent duplicates
    ]
});

module.exports = RolePermission;
