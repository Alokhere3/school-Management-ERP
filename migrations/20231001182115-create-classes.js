'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('classes', {
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
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      section: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      academicYear: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      capacity: {
        type: Sequelize.INTEGER,
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

    const existingIndexes = await queryInterface.showIndex('classes');
    const tableDesc = await queryInterface.describeTable('classes');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasTenantName = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'name']));
    if (tableDesc && tableDesc.name && !hasTenantName) {
      await queryInterface.addIndex('classes', ['tenantId', 'name']);
    }

    const hasTenantStatus = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'status']));
    if (tableDesc && tableDesc.status && !hasTenantStatus) {
      await queryInterface.addIndex('classes', ['tenantId', 'status']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('classes');
  }
};
