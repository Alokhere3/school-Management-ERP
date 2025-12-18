'use strict';

/**
 * Migration: Update Staff Table - Remove role field
 * 
 * Changes:
 * - Remove role column (roles are now managed via UserRole table)
 * - Remove role-related indexes
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            const tableDescription = await queryInterface.describeTable('staff');
            
            // Remove role column if it exists
            if (tableDescription.role) {
                await queryInterface.removeColumn('staff', 'role', { transaction });
                console.log('  ✓ Removed role column from staff table');
            }
            
            // Remove role-related indexes
            try {
                await queryInterface.removeIndex('staff', 'staff_tenantId_role', { transaction });
                console.log('  ✓ Removed staff_tenantId_role index');
            } catch (e) {
                console.log('  ℹ️ staff_tenantId_role index does not exist');
            }
            
            await transaction.commit();
            console.log('✅ Staff table updated successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error updating staff table:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            const tableDescription = await queryInterface.describeTable('staff');
            
            // Add role column back
            if (!tableDescription.role) {
                await queryInterface.addColumn('staff', 'role', {
                    type: Sequelize.STRING(100),
                    allowNull: true
                }, { transaction });
                
                // Add index back
                await queryInterface.addIndex('staff', ['tenantId', 'role'], {
                    name: 'staff_tenantId_role',
                    transaction
                });
            }
            
            await transaction.commit();
            console.log('✅ Staff table reverted successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error reverting staff table:', error.message);
            throw error;
        }
    }
};


