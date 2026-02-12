'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('student_siblings');
    if (!tableExists) {
      await queryInterface.createTable('student_siblings', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        studentId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'students',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        siblingStudentId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'students',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        relationship: {
          type: Sequelize.STRING,
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
    }

    // Check indexes separately in case table existed but indexes didn't (unlikely but safe)
    // Actually, createTable usually creates indexes if defined inline (not here).
    // The indexes below are added explicitly.

    // We can't easily check for index existence in a cross-db way without raw queries or showIndex.
    // simpler: using catch or checking via showIndex.

    try {
      await queryInterface.addIndex('student_siblings', ['studentId'], {
        name: 'idx_sibling_student_id'
      });
    } catch (e) {
      // Ignore if index exists
      if (!e.message.includes('Duplicate key name') && !e.message.includes('already exists')) {
        throw e;
      }
    }

    try {
      await queryInterface.addIndex('student_siblings', ['siblingStudentId'], {
        name: 'idx_sibling_sibling_id'
      });
    } catch (e) {
      if (!e.message.includes('Duplicate key name') && !e.message.includes('already exists')) {
        throw e;
      }
    }

    try {
      await queryInterface.addIndex('student_siblings', ['studentId', 'siblingStudentId'], {
        unique: true,
        name: 'idx_sibling_composite'
      });
    } catch (e) {
      if (!e.message.includes('Duplicate key name') && !e.message.includes('already exists')) {
        throw e;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_siblings');
  }
};
