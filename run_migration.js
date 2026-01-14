#!/usr/bin/env node

/**
 * Manual migration runner - adds deletedAt column to students table
 */

const { sequelize } = require('./config/database');

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add deletedAt to students table...');
    
    // Check if column already exists
    const tableDescription = await sequelize.queryInterface.describeTable('students');
    
    if (tableDescription.deletedAt) {
      console.log('✅ deletedAt column already exists, skipping migration');
      process.exit(0);
    }
    
    // Add the column
    await sequelize.queryInterface.addColumn('students', 'deletedAt', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
    
    console.log('✅ Successfully added deletedAt column to students table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
