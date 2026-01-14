const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Teacher Model
 * 
 * Represents a teacher as both:
 * 1. A domain entity (this table) with complete profile information
 * 2. A system user (linked to users table via userId)
 * 
 * Multi-Tenant: MUST include tenantId in all queries
 * Soft Delete: NEVER hard delete - use deletedAt
 * 
 * Files stored in S3:
 *   - profileImageKey: S3 key for profile image
 *   - resumeKey: S3 key for resume PDF
 *   - joiningLetterKey: S3 key for joining letter PDF
 * 
 * Academic Assignment:
 *   - classIds: Stored as JSON array - e.g. ["uuid1", "uuid2"]
 *   - subjectIds: Stored as JSON array - e.g. ["uuid1", "uuid2"]
 */
const Teacher = sequelize.define('Teacher', {
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

    // Link to User account (MANDATORY - teachers must be system users)
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        unique: 'uq_tenant_user_teacher' // One teacher account per user per tenant
    },

    // ========== PERSONAL INFORMATION ==========
    teacherId: {
        type: DataTypes.STRING(100),
        allowNull: false,
        // Unique per tenant (composite index created below)
    },

    firstName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },

    lastName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },

    gender: {
        type: DataTypes.ENUM('Male', 'Female', 'Other'),
        allowNull: true
    },

    dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },

    bloodGroup: {
        type: DataTypes.STRING(10), // O +ve, B +ve, B -ve, etc.
        allowNull: true
    },

    maritalStatus: {
        type: DataTypes.ENUM('Single', 'Married', 'Divorced', 'Widowed'),
        allowNull: true
    },

    languageKnown: {
        type: DataTypes.JSON,
        allowNull: true, // Array of languages: ["English", "Hindi", "Marathi"]
        defaultValue: []
    },

    qualification: {
        type: DataTypes.TEXT,
        allowNull: true // B.A, M.A, B.Ed, etc.
    },

    workExperience: {
        type: DataTypes.TEXT,
        allowNull: true // Years and type of experience
    },

    fatherName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    motherName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    permanentAddress: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    panNumber: {
        type: DataTypes.STRING(20),
        allowNull: true
    },

    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    // ========== CONTACT INFORMATION ==========
    primaryContactNumber: {
        type: DataTypes.STRING(20),
        allowNull: true
    },

    emailAddress: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    // ========== EMPLOYMENT INFORMATION ==========
    dateOfJoining: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },

    dateOfLeaving: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },

    contractType: {
        type: DataTypes.ENUM('Permanent', 'Temporary', 'Contract', 'Probation'),
        allowNull: true
    },

    workShift: {
        type: DataTypes.ENUM('Morning', 'Afternoon', 'Night'),
        allowNull: true
    },

    workLocation: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    previousSchool: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    previousSchoolAddress: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    previousSchoolPhone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },

    // ========== ACADEMIC ASSIGNMENT ==========
    classIds: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        // Array format: ["uuid1", "uuid2", "uuid3"]
    },

    subjectIds: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        // Array format: ["uuid1", "uuid2"]
    },

    // ========== PAYROLL ==========
    epfNo: {
        type: DataTypes.STRING(50),
        allowNull: true
    },

    basicSalary: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
    },

    // ========== LEAVES ==========
    medicalLeaves: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },

    casualLeaves: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },

    maternityLeaves: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },

    sickLeaves: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },

    // ========== BANK DETAILS ==========
    accountName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    accountNumber: {
        type: DataTypes.STRING(50),
        allowNull: true
    },

    bankName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    ifscCode: {
        type: DataTypes.STRING(20),
        allowNull: true
    },

    branchName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    // ========== TRANSPORT ==========
    routeId: {
        type: DataTypes.UUID,
        allowNull: true,
        // Can reference a routes/transportation table if needed
    },

    vehicleNumber: {
        type: DataTypes.STRING(50),
        allowNull: true
    },

    pickupPoint: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    // ========== HOSTEL ==========
    hostelId: {
        type: DataTypes.UUID,
        allowNull: true,
        // Can reference a hostels table if needed
    },

    roomNo: {
        type: DataTypes.STRING(50),
        allowNull: true
    },

    // ========== SOCIAL MEDIA ==========
    facebookUrl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    instagramUrl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    linkedinUrl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    youtubeUrl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    twitterUrl: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    // ========== S3 DOCUMENT KEYS (NOT URLs) ==========
    profileImageKey: {
        type: DataTypes.STRING(500),
        allowNull: true
    },

    resumeKey: {
        type: DataTypes.STRING(500),
        allowNull: true
    },

    joiningLetterKey: {
        type: DataTypes.STRING(500),
        allowNull: true
    },

    // ========== STATUS & METADATA ==========
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'on-leave', 'suspended', 'resigned'),
        defaultValue: 'active'
    },

    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE // Soft delete: NEVER hard delete
}, {
    tableName: 'teachers',
    timestamps: true,
    paranoid: false, // We manage deletedAt manually for more control
    indexes: [
        // Tenant isolation - CRITICAL
        { fields: ['tenantId'] },
        
        // Unique constraints per tenant
        { unique: true, fields: ['tenantId', 'teacherId'], name: 'uq_tenant_teacher_id' },
        { unique: true, fields: ['tenantId', 'userId'], name: 'uq_tenant_user_id' },
        
        // Foreign keys
        { fields: ['userId'] },
        { fields: ['routeId'] },
        { fields: ['hostelId'] },
        
        // Status and date searches
        { fields: ['tenantId', 'status'] },
        { fields: ['tenantId', 'dateOfJoining'] }
    ]
});

module.exports = Teacher;
