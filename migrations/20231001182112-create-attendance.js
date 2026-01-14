'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('attendance', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      studentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'students', key: 'id' }
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('present', 'absent', 'late'),
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

    const existingIndexes = await queryInterface.showIndex('attendance');
    const tableDesc = await queryInterface.describeTable('attendance');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasStudentDate = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['studentId', 'date']));
    if (tableDesc && tableDesc.date && !hasStudentDate) {
      await queryInterface.addIndex('attendance', ['studentId', 'date'], {
        unique: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('attendance');
  }
};
