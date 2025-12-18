
const { Sequelize } = require('sequelize');
require('dotenv').config();
const logger = require('./logger');

// Validate required environment variables
const requiredEnvVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 50,
            min: 5,
            acquire: 30000,
            idle: 10000
        },
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci',
            timestamps: true
        }
    }
);

// During tests we don't want to attempt a DB connection (avoids network calls / logs).
if (process.env.NODE_ENV !== 'test') {
    sequelize.authenticate()
        .then(() => logger.info('✅ MySQL Connected'))
        .catch(err => logger.error('❌ MySQL Failed:', err));
}

module.exports = { sequelize };

