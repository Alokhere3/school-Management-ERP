'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('parent_students', {
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
      parentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'parents', key: 'id' }
      },
      studentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'students', key: 'id' }
      },
      relation: {
        type: Sequelize.ENUM('Father', 'Mother', 'Guardian', 'Grandparent', 'Other'),
        allowNull: false
      },
      isPrimary: {
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

    const existingIndexes = await queryInterface.showIndex('parent_students');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasTenantStudent = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'studentId']));
    if (!hasTenantStudent) {
      await queryInterface.addIndex('parent_students', ['tenantId', 'studentId']);
    }

    const hasTenantParent = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'parentId']));
    if (!hasTenantParent) {
      await queryInterface.addIndex('parent_students', ['tenantId', 'parentId']);
    }

    const hasUnique = existingIndexes && existingIndexes.some(idx => idx && idx.name === 'uq_tenant_parent_student')
      || existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId', 'parentId', 'studentId']));
    if (!hasUnique) {
      await queryInterface.addIndex('parent_students', ['tenantId', 'parentId', 'studentId'], {
        unique: true,
        name: 'uq_tenant_parent_student'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('parent_students');
  }
};
