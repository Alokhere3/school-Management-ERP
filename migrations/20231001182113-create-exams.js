'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exams', {
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
        type: Sequelize.STRING(255),
        allowNull: false
      },
      examDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      totalMarks: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      passingMarks: {
        type: Sequelize.INTEGER,
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

    const existingIndexes = await queryInterface.showIndex('exams');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasTenant = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['tenantId']));
    if (!hasTenant) {
      await queryInterface.addIndex('exams', ['tenantId']);
    }

    const tableDesc = await queryInterface.describeTable('exams');
    const hasExamDate = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['examDate']));
    if (tableDesc && tableDesc.examDate && !hasExamDate) {
      await queryInterface.addIndex('exams', ['examDate']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('exams');
  }
};
