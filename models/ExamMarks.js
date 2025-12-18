const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExamMarks = sequelize.define('ExamMarks', {
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
    examId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'exams', key: 'id' }
    },
    marksObtained: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    totalMarks: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 100
    },
    percentage: DataTypes.DECIMAL(5, 2),
    grade: DataTypes.STRING(10),
    remarks: DataTypes.TEXT
}, {
    tableName: 'exam_marks',
    timestamps: true,
    indexes: [
        { fields: ['studentId', 'examId'] }
    ]
});

module.exports = ExamMarks;
