require('dotenv').config();
const { sequelize } = require('../config/database');
const { Sequelize } = require('sequelize');

async function addColumn() {
    const qi = sequelize.getQueryInterface();
    try {
        console.log('Adding userId column to students table...');
        await qi.addColumn('students', 'userId', {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
        console.log('✅ userId column added to students');
    } catch (err) {
        console.error('Failed to add column:', err && err.message || err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

addColumn();
