const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StudentSibling = sequelize.define('StudentSibling', {
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
    studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'students', key: 'id' }
    },
    siblingStudentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'students', key: 'id' }
    }
}, {
    tableName: 'student_siblings',
    timestamps: true,
    updatedAt: false, // Only createdAt, no updatedAt for immutable relationship records
    indexes: [
        { name: 'idx_sibling_student_id', fields: ['tenantId', 'studentId'] },
        { name: 'idx_sibling_sibling_id', fields: ['tenantId', 'siblingStudentId'] },
        { name: 'idx_sibling_composite', fields: ['tenantId', 'studentId', 'siblingStudentId'], unique: true }
    ]
});

module.exports = StudentSibling;
