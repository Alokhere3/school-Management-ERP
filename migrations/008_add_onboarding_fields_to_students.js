"use strict";

/**
 * Migration: add onboarding fields to students
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

            if (!columns['onboardingData']) {
                await queryInterface.addColumn('students', 'onboardingData', {
                    type: sequelize.Sequelize.JSON,
                    allowNull: true
                }, { transaction });
                console.log('✓ Added onboardingData column');
            } else {
                console.log('✓ onboardingData column already exists');
            }

            if (!columns['onboardingStep']) {
                await queryInterface.addColumn('students', 'onboardingStep', {
                    type: sequelize.Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: 0
                }, { transaction });
                console.log('✓ Added onboardingStep column');
            } else {
                console.log('✓ onboardingStep column already exists');
            }

            if (!columns['onboardingCompleted']) {
                await queryInterface.addColumn('students', 'onboardingCompleted', {
                    type: sequelize.Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                }, { transaction });
                console.log('✓ Added onboardingCompleted column');
            } else {
                console.log('✓ onboardingCompleted column already exists');
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Migration failed:', error.message);
            throw error;
        }
    }
};
