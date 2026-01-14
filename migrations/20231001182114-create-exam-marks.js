'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exam_marks', {
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
      examId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'exams', key: 'id' }
      },
      marksObtained: {
        type: Sequelize.DECIMAL(10, 2),
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

    await queryInterface.addIndex('exam_marks', ['studentId']);
    await queryInterface.addIndex('exam_marks', ['examId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('exam_marks');
  }
};
