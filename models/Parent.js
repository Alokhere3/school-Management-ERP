const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Parent = sequelize.define('Parent', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' }
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
        // If NULL, parent has no portal access
        // If set, parent logs in as PARENT role
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    email: DataTypes.STRING(255),
    phone: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    relation: {
        type: DataTypes.STRING(50),
        allowNull: false
        // Generic relation (updated per student via ParentStudent)
    },
    gender: DataTypes.ENUM('Male', 'Female', 'Other'),
    occupation: DataTypes.STRING(100),
    address: DataTypes.TEXT,
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active'
    }
}, {
    tableName: 'parents',
    timestamps: true,
    indexes: [
        { fields: ['tenantId', 'email'] },
        { fields: ['tenantId', 'phone'] },
        { fields: ['tenantId', 'userId'] },
        { fields: ['tenantId', 'status'] }
    ]
});

module.exports = Parent;


