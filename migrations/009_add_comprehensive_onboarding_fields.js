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

            // Helper to add column safely
            const addColumnIfNotExists = async (columnName, columnType) => {
                if (!columns[columnName]) {
                    await queryInterface.addColumn('students', columnName, columnType, { transaction });
                    console.log(`✓ Added column: ${columnName}`);
                } else {
                    console.log(`✓ Column already exists: ${columnName}`);
                }
            };

            // Application & Academic
            await addColumnIfNotExists('session', sequelize.Sequelize.STRING(50));
            await addColumnIfNotExists('admissionClass', sequelize.Sequelize.STRING(50));
            await addColumnIfNotExists('stream', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('admissionType', sequelize.Sequelize.ENUM('New', 'Transfer'));
            await addColumnIfNotExists('previousSchoolName', sequelize.Sequelize.STRING(255));
            await addColumnIfNotExists('previousSchoolBoard', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('previousClassAttended', sequelize.Sequelize.STRING(50));
            await addColumnIfNotExists('previousResult', sequelize.Sequelize.STRING(100));

            // Student Personal Details
            await addColumnIfNotExists('studentName', sequelize.Sequelize.STRING(255));
            await addColumnIfNotExists('gender', sequelize.Sequelize.ENUM('Male', 'Female', 'Other'));
            await addColumnIfNotExists('placeOfBirth', sequelize.Sequelize.STRING(255));
            await addColumnIfNotExists('motherTongue', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('nationality', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('category', sequelize.Sequelize.ENUM('General', 'OBC', 'SC', 'ST', 'Other'));
            await addColumnIfNotExists('religion', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('aadharNumber', sequelize.Sequelize.STRING(12));

            // Contact & Address
            await addColumnIfNotExists('currentAddressLine1', sequelize.Sequelize.TEXT);
            await addColumnIfNotExists('currentAddressLine2', sequelize.Sequelize.TEXT);
            await addColumnIfNotExists('currentCity', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('currentDistrict', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('currentState', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('currentPIN', sequelize.Sequelize.STRING(10));
            await addColumnIfNotExists('permanentAddressLine1', sequelize.Sequelize.TEXT);
            await addColumnIfNotExists('permanentAddressLine2', sequelize.Sequelize.TEXT);
            await addColumnIfNotExists('permanentCity', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('permanentDistrict', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('permanentState', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('permanentPIN', sequelize.Sequelize.STRING(10));
            await addColumnIfNotExists('studentMobile', sequelize.Sequelize.STRING(20));
            await addColumnIfNotExists('studentEmail', sequelize.Sequelize.STRING(100));

            // Family & Guardian Details
            await addColumnIfNotExists('fatherName', sequelize.Sequelize.STRING(255));
            await addColumnIfNotExists('fatherPhone', sequelize.Sequelize.STRING(20));
            await addColumnIfNotExists('fatherOccupation', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('fatherEmail', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('motherName', sequelize.Sequelize.STRING(255));
            await addColumnIfNotExists('motherPhone', sequelize.Sequelize.STRING(20));
            await addColumnIfNotExists('motherOccupation', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('motherEmail', sequelize.Sequelize.STRING(100));
            await addColumnIfNotExists('guardianName', sequelize.Sequelize.STRING(255));
            await addColumnIfNotExists('guardianPhone', sequelize.Sequelize.STRING(20));
            await addColumnIfNotExists('guardianRelation', sequelize.Sequelize.STRING(50));
            await addColumnIfNotExists('emergencyContact', sequelize.Sequelize.STRING(255));
            await addColumnIfNotExists('emergencyContactPhone', sequelize.Sequelize.STRING(20));

            await transaction.commit();
            console.log('✓ Migration 009 completed successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('✗ Migration 009 failed:', error.message);
            throw error;
        }
    }
};
