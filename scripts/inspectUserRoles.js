require('dotenv').config();
const { sequelize } = require('../config/database');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected');
    const [rows] = await sequelize.query('DESCRIBE user_roles');
    console.log('user_roles columns:');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err && (err.message || err));
    process.exit(1);
  }
})();
