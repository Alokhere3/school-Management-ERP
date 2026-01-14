'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('staff', {
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
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      photoUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      photoKey: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      designation: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      department: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      employeeType: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      gender: {
        type: Sequelize.ENUM('Male', 'Female', 'Other'),
        allowNull: true
      },
      primaryContactNumber: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      bloodGroup: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      maritalStatus: {
        type: Sequelize.ENUM('Single', 'Married'),
        allowNull: true
      },
      fathersName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      mothersName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      dateOfBirth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      dateOfJoining: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      languageKnown: {
        type: Sequelize.JSON,
        allowNull: true
      },
      qualification: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      workExperience: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      permanentAddress: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      epfNo: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      basicSalary: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      contractType: {
        type: Sequelize.ENUM('Permanent', 'Temporary'),
        allowNull: true
      },
      workShift: {
        type: Sequelize.ENUM('Morning', 'Afternoon', 'Night'),
        allowNull: true
      },
      workLocation: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      medicalLeaves: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      casualLeaves: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      maternityLeaves: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      sickLeaves: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      accountName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      accountNumber: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      bankName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      ifscCode: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      branchName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      transportEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      transportRoute: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      vehicleNumber: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      pickupPoint: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      hostelEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      hostelName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      roomNo: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      facebookUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      twitterUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      linkedinUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      instagramUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      resumeUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      resumeKey: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      joiningLetterUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      joiningLetterKey: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'terminated'),
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

    const existingIndexes = await queryInterface.showIndex('staff');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasTenantStatus = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'status']));
    if (!hasTenantStatus) {
      await queryInterface.addIndex('staff', ['tenantId', 'status']);
    }

    const hasTenantDepartment = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'department']));
    if (!hasTenantDepartment) {
      await queryInterface.addIndex('staff', ['tenantId', 'department']);
    }

    const hasUserId = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['userId']));
    if (!hasUserId) {
      await queryInterface.addIndex('staff', ['userId']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('staff');
  }
};
