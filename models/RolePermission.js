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
    level: {
        type: DataTypes.ENUM('none', 'read', 'limited', 'full'),
        defaultValue: 'none',
        // Interpretation:
        // - none: no access
        // - read: read-only
        // - limited: constrained to own scope (own students, own classes, etc.)
        // - full: create, update, delete, read
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
