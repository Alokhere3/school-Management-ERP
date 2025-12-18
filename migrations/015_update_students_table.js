'use strict';

/**
 * Migration: Update Students Table - Remove invalid indexes
 * 
 * Changes:
 * - Remove teacherId index (field doesn't exist)
 * - Remove parentOf index (field doesn't exist)
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Check and remove teacherId index if it exists
            try {
                const [indexes] = await queryInterface.sequelize.query(
                    `SHOW INDEXES FROM students WHERE Key_name LIKE '%teacherId%'`
                );
                
                if (indexes.length > 0) {
                    for (const idx of indexes) {
                        await queryInterface.sequelize.query(
                            `ALTER TABLE students DROP INDEX ${idx.Key_name}`,
                            { transaction }
                        );
                        console.log(`  ✓ Removed index: ${idx.Key_name}`);
                    }
                }
            } catch (e) {
                console.log('  ℹ️ No teacherId indexes to remove');
            }
            
            // Check and remove parentOf index if it exists
            try {
                const [indexes] = await queryInterface.sequelize.query(
                    `SHOW INDEXES FROM students WHERE Key_name LIKE '%parentOf%'`
                );
                
                if (indexes.length > 0) {
                    for (const idx of indexes) {
                        await queryInterface.sequelize.query(
                            `ALTER TABLE students DROP INDEX ${idx.Key_name}`,
                            { transaction }
                        );
                        console.log(`  ✓ Removed index: ${idx.Key_name}`);
                    }
                }
            } catch (e) {
                console.log('  ℹ️ No parentOf indexes to remove');
            }
            
            await transaction.commit();
            console.log('✅ Students table updated successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error updating students table:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        // No-op: we don't want to recreate invalid indexes
        console.log('  ℹ️ Down migration skipped (indexes were invalid)');
    }
};


