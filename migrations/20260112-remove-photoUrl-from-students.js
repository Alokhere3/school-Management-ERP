'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the photoUrl column from students table
    await queryInterface.removeColumn('students', 'photoUrl');
  },

  down: async (queryInterface, Sequelize) => {
    // Restore the photoUrl column if migration is rolled back
    await queryInterface.addColumn('students', 'photoUrl', {
      type: Sequelize.STRING(500),
      allowNull: true
    });
  }
};
