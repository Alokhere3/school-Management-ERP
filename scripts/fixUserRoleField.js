const { sequelize } = require('../config/database');

async function main() {
  try {
    await sequelize.authenticate();
    // ALTER TABLE to change ENUM -> VARCHAR safely
    const sql = `ALTER TABLE \`users\` MODIFY COLUMN \`role\` VARCHAR(100) DEFAULT 'user' NULL;`;
    await sequelize.query(sql);
    console.log('✅ Successfully changed role column from ENUM to VARCHAR(100)');
    process.exit(0);
  } catch (err) {
    console.error('Failed to alter users.role column:', err && err.message);
    process.exit(1);
  }
}

main();
