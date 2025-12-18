const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ParentStudent = sequelize.define('ParentStudent', {
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
    parentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'parents', key: 'id' }
    },
    studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'students', key: 'id' }
    },
    relation: {
        type: DataTypes.ENUM('Father', 'Mother', 'Guardian', 'Grandparent', 'Other'),
        allowNull: false
    },
    isPrimary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
        // Marks the primary contact for notifications
    }
}, {
    tableName: 'parent_students',
    timestamps: true,
    indexes: [
        { fields: ['tenantId', 'studentId'] },
        { fields: ['tenantId', 'parentId'] },
        { unique: true, fields: ['tenantId', 'parentId', 'studentId'], name: 'uq_tenant_parent_student' }
    ]
});

module.exports = ParentStudent;


