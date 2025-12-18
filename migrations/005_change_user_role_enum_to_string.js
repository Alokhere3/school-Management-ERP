'use strict';

const { sequelize } = require('../config/database');

module.exports = {
    up: async () => {
        const queryInterface = sequelize.getQueryInterface();
        const transaction = await sequelize.transaction();

        try {
            const tableExists = await queryInterface.showAllTables();
            if (!tableExists.includes('users')) {
                console.log('Users table does not exist, skipping migration');
                await transaction.rollback();
                return;
            }

            const columns = await queryInterface.describeTable('users', { transaction });
            if (columns['role']) {
                await queryInterface.changeColumn('users', 'role', {
                    type: sequelize.Sequelize.STRING(100),
                    allowNull: true,
                    defaultValue: 'user'
                }, { transaction });
                console.log('✓ Changed role column to STRING');
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Migration failed:', error.message);
            throw error;
        }
    }
};
