'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('roles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tenants', key: 'id' }
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      isSystemRole: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
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

    const existingIndexes = await queryInterface.showIndex('roles');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasTenantName = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'name']));
    if (!hasTenantName) {
      await queryInterface.addIndex('roles', ['tenantId', 'name'], {
        unique: true
      });
    }

    const hasIsSystemName = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['isSystemRole', 'name']));
    if (!hasIsSystemName) {
      await queryInterface.addIndex('roles', ['isSystemRole', 'name']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('roles');
  }
};
