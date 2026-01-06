const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Class = sequelize.define('Class', {
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
    className: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    section: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    noOfStudents: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    noOfSubjects: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active'
    }
}, {
    tableName: 'classes',
    timestamps: true,
    indexes: [
        { fields: ['tenantId'] },
        { fields: ['tenantId', 'status'] },
        { fields: ['className'] }
    ]
});

module.exports = Class;
