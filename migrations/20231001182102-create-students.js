'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('students', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' }
      },
      admissionNo: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      dateOfBirth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      photoUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      photoKey: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      classId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'classes', key: 'id' }
      },
      rollNumber: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      classData: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null
      },
      session: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      admissionClass: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      stream: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      admissionType: {
        type: Sequelize.ENUM('New', 'Transfer'),
        allowNull: true
      },
      previousSchoolName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      previousSchoolBoard: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      previousClassAttended: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      previousResult: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      studentName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      gender: {
        type: Sequelize.ENUM('Male', 'Female', 'Other'),
        allowNull: true
      },
      placeOfBirth: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      motherTongue: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      nationality: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      category: {
        type: Sequelize.ENUM('General', 'OBC', 'SC', 'ST', 'Other'),
        allowNull: true
      },
      religion: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      aadharNumber: {
        type: Sequelize.STRING(12),
        allowNull: true
      },
      currentAddressLine1: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      currentAddressLine2: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      currentCity: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      currentDistrict: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      currentState: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      currentPIN: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      permanentAddressLine1: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      permanentAddressLine2: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      permanentCity: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      permanentDistrict: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      permanentState: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      permanentPIN: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      studentMobile: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      studentEmail: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      fatherName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      fatherPhone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      fatherOccupation: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      fatherEmail: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      motherName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      motherPhone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      motherOccupation: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      motherEmail: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      guardianName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      guardianPhone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      guardianRelation: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      emergencyContact: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      emergencyContactPhone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      onboardingData: {
        type: Sequelize.JSON,
        allowNull: true
      },
      onboardingStep: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      onboardingCompleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        defaultValue: 'active'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    const existingIndexes = await queryInterface.showIndex('students');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasComposite = existingIndexes && existingIndexes.some(idx => idx && idx.name === 'compositeIndex');
    if (!hasComposite) {
      await queryInterface.addIndex('students', ['tenantId', 'admissionNo'], {
        unique: true,
        name: 'compositeIndex'
      });
    }

    const hasTenantStatus = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'status']));
    if (!hasTenantStatus) {
      await queryInterface.addIndex('students', ['tenantId', 'status']);
    }

    const hasTenantUser = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'userId']));
    if (!hasTenantUser) {
      await queryInterface.addIndex('students', ['tenantId', 'userId']);
    }

    const hasTenantAdmissionClass = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'admissionClass']));
    if (!hasTenantAdmissionClass) {
      await queryInterface.addIndex('students', ['tenantId', 'admissionClass']);
    }

    const hasCreatedAt = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['createdAt']));
    if (!hasCreatedAt) {
      await queryInterface.addIndex('students', ['createdAt']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('students');
  }
};
