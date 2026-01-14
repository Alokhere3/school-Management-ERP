"use strict";

/**
 * Migration: create teachers table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('teachers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      teacherId: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      firstName: { type: Sequelize.STRING(100), allowNull: false },
      lastName: { type: Sequelize.STRING(100), allowNull: false },
      gender: { type: Sequelize.ENUM('Male','Female','Other') , allowNull: true},
      dateOfBirth: { type: Sequelize.DATEONLY, allowNull: true },
      bloodGroup: { type: Sequelize.STRING(10), allowNull: true },
      maritalStatus: { type: Sequelize.ENUM('Single','Married','Divorced','Widowed'), allowNull: true },
      languageKnown: { type: Sequelize.JSON, allowNull: true, defaultValue: [] },
      qualification: { type: Sequelize.TEXT, allowNull: true },
      workExperience: { type: Sequelize.TEXT, allowNull: true },
      fatherName: { type: Sequelize.STRING(255), allowNull: true },
      motherName: { type: Sequelize.STRING(255), allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      permanentAddress: { type: Sequelize.TEXT, allowNull: true },
      panNumber: { type: Sequelize.STRING(20), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      primaryContactNumber: { type: Sequelize.STRING(20), allowNull: true },
      emailAddress: { type: Sequelize.STRING(255), allowNull: true },
      dateOfJoining: { type: Sequelize.DATEONLY, allowNull: true },
      dateOfLeaving: { type: Sequelize.DATEONLY, allowNull: true },
      contractType: { type: Sequelize.ENUM('Permanent','Temporary','Contract','Probation'), allowNull: true },
      workShift: { type: Sequelize.ENUM('Morning','Afternoon','Night'), allowNull: true },
      workLocation: { type: Sequelize.STRING(255), allowNull: true },
      previousSchool: { type: Sequelize.STRING(255), allowNull: true },
      previousSchoolAddress: { type: Sequelize.TEXT, allowNull: true },
      previousSchoolPhone: { type: Sequelize.STRING(20), allowNull: true },
      classIds: { type: Sequelize.JSON, allowNull: true, defaultValue: [] },
      subjectIds: { type: Sequelize.JSON, allowNull: true, defaultValue: [] },
      epfNo: { type: Sequelize.STRING(50), allowNull: true },
      basicSalary: { type: Sequelize.DECIMAL(12,2), allowNull: true },
      medicalLeaves: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      casualLeaves: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      maternityLeaves: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      sickLeaves: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      accountName: { type: Sequelize.STRING(255), allowNull: true },
      accountNumber: { type: Sequelize.STRING(50), allowNull: true },
      bankName: { type: Sequelize.STRING(255), allowNull: true },
      ifscCode: { type: Sequelize.STRING(20), allowNull: true },
      branchName: { type: Sequelize.STRING(255), allowNull: true },
      routeId: { type: Sequelize.UUID, allowNull: true },
      vehicleNumber: { type: Sequelize.STRING(50), allowNull: true },
      pickupPoint: { type: Sequelize.STRING(255), allowNull: true },
      hostelId: { type: Sequelize.UUID, allowNull: true },
      roomNo: { type: Sequelize.STRING(50), allowNull: true },
      facebookUrl: { type: Sequelize.STRING(255), allowNull: true },
      instagramUrl: { type: Sequelize.STRING(255), allowNull: true },
      linkedinUrl: { type: Sequelize.STRING(255), allowNull: true },
      youtubeUrl: { type: Sequelize.STRING(255), allowNull: true },
      twitterUrl: { type: Sequelize.STRING(255), allowNull: true },
      profileImageKey: { type: Sequelize.STRING(500), allowNull: true },
      resumeKey: { type: Sequelize.STRING(500), allowNull: true },
      joiningLetterKey: { type: Sequelize.STRING(500), allowNull: true },
      status: { type: Sequelize.ENUM('active','inactive','on-leave','suspended','resigned'), allowNull: false, defaultValue: 'active' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deletedAt: { type: Sequelize.DATE, allowNull: true }
    });

    // Indexes (only create if they don't already exist)
    const existingIndexes = await queryInterface.showIndex('teachers');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasTenantIdx = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId']));
    if (!hasTenantIdx) await queryInterface.addIndex('teachers', ['tenantId'], { name: 'idx_teachers_tenant' });

    const hasTenantTeacherId = existingIndexes && existingIndexes.some(idx => idx && idx.name === 'uq_tenant_teacher_id') || existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId','teacherId']));
    if (!hasTenantTeacherId) await queryInterface.addIndex('teachers', ['tenantId','teacherId'], { unique: true, name: 'uq_tenant_teacher_id' });

    const hasTenantUserId = existingIndexes && existingIndexes.some(idx => idx && idx.name === 'uq_tenant_user_id') || existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId','userId']));
    if (!hasTenantUserId) await queryInterface.addIndex('teachers', ['tenantId','userId'], { unique: true, name: 'uq_tenant_user_id' });

    const hasUserIdx = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['userId']));
    if (!hasUserIdx) await queryInterface.addIndex('teachers', ['userId'], { name: 'idx_teachers_user' });

    const hasRouteIdx = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['routeId']));
    if (!hasRouteIdx) await queryInterface.addIndex('teachers', ['routeId'], { name: 'idx_teachers_route' });

    const hasHostelIdx = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['hostelId']));
    if (!hasHostelIdx) await queryInterface.addIndex('teachers', ['hostelId'], { name: 'idx_teachers_hostel' });

    const hasTenantStatus = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId','status']));
    if (!hasTenantStatus) await queryInterface.addIndex('teachers', ['tenantId','status'], { name: 'idx_teachers_tenant_status' });

    const hasTenantDoj = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId','dateOfJoining']));
    if (!hasTenantDoj) await queryInterface.addIndex('teachers', ['tenantId','dateOfJoining'], { name: 'idx_teachers_tenant_doj' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('teachers', 'idx_teachers_tenant_doj');
    await queryInterface.removeIndex('teachers', 'idx_teachers_tenant_status');
    await queryInterface.removeIndex('teachers', 'idx_teachers_hostel');
    await queryInterface.removeIndex('teachers', 'idx_teachers_route');
    await queryInterface.removeIndex('teachers', 'idx_teachers_user');
    await queryInterface.removeIndex('teachers', 'uq_tenant_user_id');
    await queryInterface.removeIndex('teachers', 'uq_tenant_teacher_id');
    await queryInterface.removeIndex('teachers', 'idx_teachers_tenant');
    await queryInterface.dropTable('teachers');
  }
};
