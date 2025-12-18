
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Student = sequelize.define('Student', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        // reference the table name string to avoid circular require of the Tenant model
        references: { model: 'tenants', key: 'id' }
    },
    admissionNo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: 'compositeIndex'
    },
    firstName: DataTypes.STRING(100),
    lastName: DataTypes.STRING(100),
    dateOfBirth: DataTypes.DATEONLY,
    photoUrl: DataTypes.STRING(500),
    // store the S3 object key (tenants/<id>/students/...), not the public URL
    photoKey: DataTypes.STRING(500),
    // link to a User account when the student has a corresponding user (nullable)
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    // ========== APPLICATION & ACADEMIC INFO ==========
    session: DataTypes.STRING(50),
    admissionClass: DataTypes.STRING(50),
    stream: DataTypes.STRING(100),
    admissionType: {
        type: DataTypes.ENUM('New', 'Transfer'),
        allowNull: true
    },
    previousSchoolName: DataTypes.STRING(255),
    previousSchoolBoard: DataTypes.STRING(100),
    previousClassAttended: DataTypes.STRING(50),
    previousResult: DataTypes.STRING(100),

    // ========== STUDENT PERSONAL DETAILS ==========
    studentName: DataTypes.STRING(255),
    gender: {
        type: DataTypes.ENUM('Male', 'Female', 'Other'),
        allowNull: true
    },
    placeOfBirth: DataTypes.STRING(255),
    motherTongue: DataTypes.STRING(100),
    nationality: DataTypes.STRING(100),
    category: {
        type: DataTypes.ENUM('General', 'OBC', 'SC', 'ST', 'Other'),
        allowNull: true
    },
    religion: DataTypes.STRING(100),
    aadharNumber: DataTypes.STRING(12),

    // ========== CONTACT & ADDRESS ==========
    currentAddressLine1: DataTypes.TEXT,
    currentAddressLine2: DataTypes.TEXT,
    currentCity: DataTypes.STRING(100),
    currentDistrict: DataTypes.STRING(100),
    currentState: DataTypes.STRING(100),
    currentPIN: DataTypes.STRING(10),
    permanentAddressLine1: DataTypes.TEXT,
    permanentAddressLine2: DataTypes.TEXT,
    permanentCity: DataTypes.STRING(100),
    permanentDistrict: DataTypes.STRING(100),
    permanentState: DataTypes.STRING(100),
    permanentPIN: DataTypes.STRING(10),
    studentMobile: DataTypes.STRING(20),
    studentEmail: DataTypes.STRING(100),

    // ========== FAMILY & GUARDIAN DETAILS ==========
    fatherName: DataTypes.STRING(255),
    fatherPhone: DataTypes.STRING(20),
    fatherOccupation: DataTypes.STRING(100),
    fatherEmail: DataTypes.STRING(100),
    motherName: DataTypes.STRING(255),
    motherPhone: DataTypes.STRING(20),
    motherOccupation: DataTypes.STRING(100),
    motherEmail: DataTypes.STRING(100),
    guardianName: DataTypes.STRING(255),
    guardianPhone: DataTypes.STRING(20),
    guardianRelation: DataTypes.STRING(50),
    emergencyContact: DataTypes.STRING(255),
    emergencyContactPhone: DataTypes.STRING(20),

    // ========== ONBOARDING SUPPORT ==========
    onboardingData: {
        type: DataTypes.JSON,
        allowNull: true
    },
    onboardingStep: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    onboardingCompleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active'
    }
}, {
    tableName: 'students',
    timestamps: true,
    indexes: [
        { name: 'compositeIndex', unique: true, fields: ['tenantId', 'admissionNo'] },
        { fields: ['tenantId', 'status'] },
        { fields: ['tenantId', 'userId'] },
        { fields: ['tenantId', 'admissionClass'] },
        { fields: ['createdAt'] }
    ]
});

module.exports = Student;

