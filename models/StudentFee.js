const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StudentFee = sequelize.define('StudentFee', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'students', key: 'id' }
    },
    feeType: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    dueDate: DataTypes.DATE,
    paidDate: DataTypes.DATE,
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'partial', 'overdue'),
        defaultValue: 'pending'
    },
    remarks: DataTypes.TEXT
}, {
    tableName: 'student_fees',
    timestamps: true,
    indexes: [
        { fields: ['studentId', 'status'] }
    ]
});

module.exports = StudentFee;
