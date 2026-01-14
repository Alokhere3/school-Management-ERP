'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('student_fees', {
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
      feeType: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      dueDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'overdue'),
        defaultValue: 'pending'
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

    const existingIndexes = await queryInterface.showIndex('student_fees');
    const tableDesc = await queryInterface.describeTable('student_fees');

    const indexHasColumns = (idx, cols) => {
      if (!idx || !idx.fields) return false;
      const existingCols = idx.fields.map(f => f.attribute || f.name || f.column || f.field).filter(Boolean);
      if (existingCols.length !== cols.length) return false;
      return cols.every(c => existingCols.includes(c));
    };

    const hasStudentFeeType = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['studentId', 'feeType']));
    if (tableDesc && tableDesc.studentId && tableDesc.feeType && !hasStudentFeeType) {
      await queryInterface.addIndex('student_fees', ['studentId', 'feeType']);
    }

    const hasStudentStatus = existingIndexes && existingIndexes.some(idx => indexHasColumns(idx, ['studentId', 'status']));
    if (tableDesc && tableDesc.studentId && tableDesc.status && !hasStudentStatus) {
      await queryInterface.addIndex('student_fees', ['studentId', 'status']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_fees');
  }
};
