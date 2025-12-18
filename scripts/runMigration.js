require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');
const { Sequelize } = require('sequelize');

async function ensureMigrationsTable(queryInterface, Sequelize) {
    // Create a simple migrations tracking table if it doesn't exist
    try {
        const tableNames = await queryInterface.showAllTables();
        const normalized = tableNames.map(t => (typeof t === 'object' && t.tableName) ? t.tableName : t);
        if (!normalized.includes('migrations')) {
            await queryInterface.createTable('migrations', {
                name: { type: Sequelize.STRING, primaryKey: true },
                run_at: { type: Sequelize.DATE, allowNull: false }
            });
            console.log('✅ Created migrations tracking table');
        }
    } catch (err) {
        // Some dialects may return different shapes from showAllTables; attempt create and ignore if exists
        try {
            await queryInterface.createTable('migrations', {
                name: { type: Sequelize.STRING, primaryKey: true },
                run_at: { type: Sequelize.DATE, allowNull: false }
            });
            console.log('✅ Created migrations tracking table');
        } catch (e) {
            // ignore if already exists
        }
    }
}

async function runMigrations() {
    const queryInterface = sequelize.getQueryInterface();
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL Connected');

        await ensureMigrationsTable(queryInterface, Sequelize);

        const migrationsDir = path.resolve(__dirname, '..', 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.js'))
            .sort();

        for (const file of files) {
            const name = file;

            // Check if migration applied
            const [results] = await sequelize.query('SELECT name FROM migrations WHERE name = ? LIMIT 1', { replacements: [name] });
            if (results && results.length > 0) {
                console.log(`- Skipping already applied migration: ${name}`);
                continue;
            }

            console.log(`-> Applying migration: ${name}`);
            const migration = require(path.join(migrationsDir, file));
            if (!migration || typeof migration.up !== 'function') {
                console.warn(`   Migration ${name} has no up() — skipping`);
                continue;
            }

            await migration.up(queryInterface, Sequelize);

            // Record migration as applied
            await sequelize.query('INSERT INTO migrations (name, run_at) VALUES (?, ?)', { replacements: [name, new Date()] });
            console.log(`   Applied ${name}`);
        }

        console.log('✅ All pending migrations applied');
    } catch (err) {
        console.error('❌ Migration run failed:', err && (err.stack || err.message || err));
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
