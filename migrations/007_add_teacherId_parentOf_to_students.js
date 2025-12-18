"use strict";

/**
 * Migration: add teacherId and parentOf columns to students
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

            if (!columns['teacherId']) {
                await queryInterface.addColumn('students', 'teacherId', {
                    type: sequelize.Sequelize.UUID,
                    allowNull: true,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                }, { transaction });
                console.log('✓ Added teacherId column');
            } else {
                console.log('✓ teacherId column already exists');
            }

            if (!columns['parentOf']) {
                await queryInterface.addColumn('students', 'parentOf', {
                    type: sequelize.Sequelize.UUID,
                    allowNull: true,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                }, { transaction });
                console.log('✓ Added parentOf column');
            } else {
                console.log('✓ parentOf column already exists');
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Migration failed:', error.message);
            throw error;
        }
    }
};
