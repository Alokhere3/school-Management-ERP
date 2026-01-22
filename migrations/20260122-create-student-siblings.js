'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('student_siblings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      studentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'students', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      siblingStudentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'students', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for efficient querying
    await queryInterface.addIndex('student_siblings', ['tenantId', 'studentId'], { name: 'idx_sibling_student_id' });
    await queryInterface.addIndex('student_siblings', ['tenantId', 'siblingStudentId'], { name: 'idx_sibling_sibling_id' });
    await queryInterface.addIndex('student_siblings', ['tenantId', 'studentId', 'siblingStudentId'], { name: 'idx_sibling_composite', unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_siblings');
  }
};
