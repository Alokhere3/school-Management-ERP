'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
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
      email: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      passwordHash: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      mustChangePassword: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      lastPasswordChangedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended'),
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

    // Ensure we don't try to add an index that already exists (prevents duplicate key errors)
    const existingIndexes = await queryInterface.showIndex('users');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasUqTenantEmail = existingIndexes && existingIndexes.some(idx => idx && idx.name === 'uq_tenant_email');
    if (!hasUqTenantEmail) {
      await queryInterface.addIndex('users', ['tenantId', 'email'], {
        unique: true,
        name: 'uq_tenant_email'
      });
    }

    const hasTenantPhone = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'phone']));
    if (!hasTenantPhone) {
      await queryInterface.addIndex('users', ['tenantId', 'phone']);
    }

    const hasTenantStatus = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'status']));
    if (!hasTenantStatus) {
      await queryInterface.addIndex('users', ['tenantId', 'status']);
    }

    const hasCreatedAt = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['createdAt']));
    if (!hasCreatedAt) {
      await queryInterface.addIndex('users', ['createdAt']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};
