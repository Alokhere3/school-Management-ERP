const { sequelize } = require('../config/database');
const PermissionResolver = require('../services/PermissionResolver');
const { User, Role } = require('../models');

async function verifyInheritance() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const userId = 'b3ba4904-b097-4cd2-8fea-8ce7a08f5770';
        const tenantId = '9fbb8d86-ce85-49ee-a521-e5e0fb2206c1';

        const resolver = new PermissionResolver(User, Role);

        console.log('Resolving permissions...');
        const roleCodes = await resolver.resolveRoles(userId, tenantId);
        console.log('Resolved Role Codes:', roleCodes);

        const policy = await resolver.resolvePermissions(userId, tenantId);

        const studentsRead = policy['students:read'];
        if (studentsRead && studentsRead.allowed) {
            console.log('✅ SUCCESS: User has students:read permission!');
            console.log('Scope:', studentsRead.scope);
        } else {
            console.error('❌ FAILURE: User still missing students:read');
            console.log('Policy Entry:', studentsRead);
        }

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await sequelize.close();
    }
}

verifyInheritance();
