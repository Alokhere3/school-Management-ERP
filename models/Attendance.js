const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Attendance = sequelize.define('Attendance', {
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
    attendanceDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('present', 'absent', 'late', 'excused'),
        allowNull: false,
        defaultValue: 'present'
    },
    remarks: DataTypes.TEXT
}, {
    tableName: 'attendance',
    timestamps: true,
    indexes: [
        { fields: ['studentId', 'attendanceDate'] }
    ]
});

module.exports = Attendance;
