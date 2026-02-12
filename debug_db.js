const { sequelize } = require('./config/database');
const { Tenant } = require('./models');

async function testConnection() {
    try {
        console.error('Testing connection...');
        const tenants = await Tenant.findAll();
        console.error(`Found ${tenants.length} tenants.`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

testConnection();
