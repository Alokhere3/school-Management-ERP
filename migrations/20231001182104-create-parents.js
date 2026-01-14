'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('parents', {
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
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      relation: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      gender: {
        type: Sequelize.ENUM('Male', 'Female', 'Other'),
        allowNull: true
      },
      occupation: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
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

    const existingIndexes = await queryInterface.showIndex('parents');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasTenantEmail = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'email']));
    if (!hasTenantEmail) {
      await queryInterface.addIndex('parents', ['tenantId', 'email']);
    }

    const hasTenantPhone = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'phone']));
    if (!hasTenantPhone) {
      await queryInterface.addIndex('parents', ['tenantId', 'phone']);
    }

    const hasTenantUser = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'userId']));
    if (!hasTenantUser) {
      await queryInterface.addIndex('parents', ['tenantId', 'userId']);
    }

    const hasTenantStatus = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'status']));
    if (!hasTenantStatus) {
      await queryInterface.addIndex('parents', ['tenantId', 'status']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('parents');
  }
};
