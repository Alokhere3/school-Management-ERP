const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Staff = sequelize.define('Staff', {
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
    // Link to User account (nullable - staff may not have login access)
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    
    // ========== PERSONAL INFORMATION ==========
    firstName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    lastName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    photoUrl: DataTypes.STRING(500),
    photoKey: DataTypes.STRING(500),
    
    // HR attributes (NOT auth roles - roles are managed via UserRole)
    designation: DataTypes.STRING(100),
    department: DataTypes.STRING(100),
    employeeType: DataTypes.STRING(100),
    gender: {
        type: DataTypes.ENUM('Male', 'Female', 'Other'),
        allowNull: true
    },
    primaryContactNumber: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: { isEmail: true }
    },
    bloodGroup: {
        type: DataTypes.STRING(10),
        allowNull: true // O +ve, B +ve, B -ve, etc.
    },
    maritalStatus: {
        type: DataTypes.ENUM('Single', 'Married'),
        allowNull: true
    },
    fathersName: DataTypes.STRING(255),
    mothersName: DataTypes.STRING(255),
    dateOfBirth: DataTypes.DATEONLY,
    dateOfJoining: DataTypes.DATEONLY,
    languageKnown: {
        type: DataTypes.JSON,
        allowNull: true // Array of languages
    },
    qualification: DataTypes.STRING(255),
    workExperience: DataTypes.STRING(255),
    note: DataTypes.TEXT,
    address: DataTypes.TEXT,
    permanentAddress: DataTypes.TEXT,
    
    // ========== PAYROLL ==========
    epfNo: DataTypes.STRING(50),
    basicSalary: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    contractType: {
        type: DataTypes.ENUM('Permanent', 'Temporary'),
        allowNull: true
    },
    workShift: {
        type: DataTypes.ENUM('Morning', 'Afternoon', 'Night'),
        allowNull: true
    },
    workLocation: DataTypes.STRING(255),
    
    // ========== LEAVES ==========
    medicalLeaves: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    casualLeaves: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    maternityLeaves: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sickLeaves: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    
    // ========== BANK DETAILS ==========
    accountName: DataTypes.STRING(255),
    accountNumber: DataTypes.STRING(50),
    bankName: DataTypes.STRING(255),
    ifscCode: DataTypes.STRING(20),
    branchName: DataTypes.STRING(255),
    
    // ========== TRANSPORT INFORMATION ==========
    transportEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    transportRoute: DataTypes.STRING(255),
    vehicleNumber: DataTypes.STRING(50),
    pickupPoint: DataTypes.STRING(255),
    
    // ========== HOSTEL INFORMATION ==========
    hostelEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    hostelName: DataTypes.STRING(255),
    roomNo: DataTypes.STRING(50),
    
    // ========== SOCIAL MEDIA LINKS ==========
    facebookUrl: DataTypes.STRING(500),
    twitterUrl: DataTypes.STRING(500),
    linkedinUrl: DataTypes.STRING(500),
    instagramUrl: DataTypes.STRING(500),
    
    // ========== DOCUMENTS ==========
    resumeUrl: DataTypes.STRING(500),
    resumeKey: DataTypes.STRING(500),
    joiningLetterUrl: DataTypes.STRING(500),
    joiningLetterKey: DataTypes.STRING(500),
    
    // ========== STATUS ==========
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'terminated'),
        defaultValue: 'active'
    }
}, {
    tableName: 'staff',
    timestamps: true,
    indexes: [
        { fields: ['tenantId', 'status'] },
        { fields: ['tenantId', 'department'] },
        { fields: ['userId'] }
    ]
});

module.exports = Staff;

