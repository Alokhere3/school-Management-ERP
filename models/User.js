const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
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
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { isEmail: true }
        // Unique per tenant, not globally (enforced via composite unique index)
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true
        // Alternative login identifier (future support)
    },
    passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    mustChangePassword: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
        // Force password change on first login
    },
    lastPasswordChangedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active'
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
}, {
    tableName: 'users',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['tenantId', 'email'], name: 'uq_tenant_email' },
        { fields: ['tenantId', 'phone'] },
        { fields: ['tenantId', 'status'] },
        { fields: ['createdAt'] }
    ]
});

module.exports = User;
