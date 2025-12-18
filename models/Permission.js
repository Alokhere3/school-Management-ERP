const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Permission = sequelize.define('Permission', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    resource: {
        type: DataTypes.STRING(100),
        allowNull: false,
        // Examples: "students", "fees", "attendance", "exams", "users", "roles", etc.
    },
    action: {
        type: DataTypes.ENUM('create', 'read', 'update', 'delete', 'export'),
        allowNull: false,
        // Standard CRUD + export
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'permissions',
    timestamps: true,
    indexes: [
        { fields: ['resource', 'action'], unique: true }
    ]
});

module.exports = Permission;
