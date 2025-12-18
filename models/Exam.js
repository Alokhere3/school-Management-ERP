const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Exam = sequelize.define('Exam', {
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
    name: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    description: DataTypes.TEXT,
    startDate: DataTypes.DATE,
    endDate: DataTypes.DATE,
    totalMarks: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    }
}, {
    tableName: 'exams',
    timestamps: true,
    indexes: [
        { fields: ['tenantId'] }
    ]
});

module.exports = Exam;
