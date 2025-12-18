"use strict";

/**
 * Migration: add userId column to students
 */
const { sequelize } = require('../config/database');

module.exports = {
    up: async () => {
        const queryInterface = sequelize.getQueryInterface();
        const transaction = await sequelize.transaction();

        try {
            const tableExists = await queryInterface.showAllTables();
            if (!tableExists.includes('students')) {
                console.log('Students table does not exist, skipping migration');
                await transaction.rollback();
                return;
            }

            const columns = await queryInterface.describeTable('students', { transaction });
            if (!columns['userId']) {
                await queryInterface.addColumn('students', 'userId', {
                    type: sequelize.Sequelize.UUID,
                    allowNull: true,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                }, { transaction });
                console.log('✓ Added userId column');
            } else {
                console.log('✓ userId column already exists');
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Migration failed:', error.message);
            throw error;
        }
    }
};
