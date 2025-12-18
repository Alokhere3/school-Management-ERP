/**
 * Migration: add photoKey column to students table
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
            
            if (!columns['photoKey']) {
                await queryInterface.addColumn('students', 'photoKey', {
                    type: sequelize.Sequelize.STRING(500),
                    allowNull: true
                }, { transaction });
                console.log('✓ Added photoKey column');
            } else {
                console.log('✓ photoKey column already exists');
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Migration failed:', error.message);
            throw error;
        }
    }
};
