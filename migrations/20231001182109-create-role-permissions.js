'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('role_permissions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      roleId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'roles', key: 'id' }
      },
      permissionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'permissions', key: 'id' }
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

    const existingIndexes = await queryInterface.showIndex('role_permissions');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasRoleId = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['roleId']));
    if (!hasRoleId) {
      await queryInterface.addIndex('role_permissions', ['roleId']);
    }

    const hasPermissionId = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['permissionId']));
    if (!hasPermissionId) {
      await queryInterface.addIndex('role_permissions', ['permissionId']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('role_permissions');
  }
};
