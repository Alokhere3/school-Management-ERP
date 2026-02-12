
const { sequelize } = require('./config/database');
const { getRolePermissions } = require('./services/rolePermissionService');
const Role = require('./models/Role');

async function verify() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected.');

        // Find a role to test (e.g., Teacher)
        const role = await Role.findOne({ where: { name: 'Teacher' } });

        if (!role) {
            console.error('Teacher role not found. Please seed roles first.');
            return;
        }

        console.log(`Testing permissions for role: ${role.name} (${role.id})`);

        const permissions = await getRolePermissions(role.id);

        console.log(`Retrieved ${permissions.length} modules.`);

        // Check for a module that Teacher shouldn't have access to (e.g., tenant_management)
        const tenantMgmt = permissions.find(p => p.module === 'tenant_management');

        if (tenantMgmt) {
            console.log('Verifying tenant_management (should be all "none"):');
            console.log(JSON.stringify(tenantMgmt, null, 2));

            const hasNone = Object.values(tenantMgmt.permissions).some(val => val === 'none');
            if (hasNone) {
                console.log('SUCCESS: Found "none" permissions for unassigned module.');
            } else {
                console.error('FAILURE: expected "none" permissions, but found values.');
            }
        } else {
            console.error('FAILURE: tenant_management module missing from response.');
        }

        // Check for a module that Teacher DOES have access to (e.g., classes)
        const classes = permissions.find(p => p.module === 'classes');
        if (classes) {
            console.log('Verifying classes (should have mix):');
            console.log(JSON.stringify(classes, null, 2));
        }

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await sequelize.close();
    }
}

verify();
