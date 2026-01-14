'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_roles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' }
      },
      role: {
        type: Sequelize.ENUM(
          'SUPER_ADMIN',
          'SCHOOL_ADMIN',
          'TEACHER',
          'STAFF',
          'STUDENT',
          'PARENT',
          'ACCOUNTANT',
          'LIBRARIAN',
          'ADMIN'
        ),
        allowNull: false
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

    const existingIndexes = await queryInterface.showIndex('user_roles');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasUserTenant = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['userId', 'tenantId']));
    if (!hasUserTenant) {
      await queryInterface.addIndex('user_roles', ['userId', 'tenantId']);
    }

    const hasTenantRole = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'role']));
    if (!hasTenantRole) {
      await queryInterface.addIndex('user_roles', ['tenantId', 'role']);
    }

    const hasUnique = existingIndexes && existingIndexes.some(idx => idx && idx.name === 'uq_user_tenant_role')
      || existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['userId', 'tenantId', 'role']));
    if (!hasUnique) {
      await queryInterface.addIndex('user_roles', ['userId', 'tenantId', 'role'], {
        unique: true,
        name: 'uq_user_tenant_role'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_roles');
  }
};
