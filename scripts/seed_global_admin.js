const { sequelize } = require('../config/database');
const { Role, Permission, RolePermission } = require('../models');

async function seedPermissions() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const roleCode = 'SCHOOL_ADMIN_GLOBAL';
        const role = await Role.findOne({ where: { code: roleCode } });

        if (!role) {
            console.error(`❌ Role '${roleCode}' not found!`);
            return;
        }

        console.log(`✅ Found Role: ${role.name} (ID: ${role.id})`);

        // Resources to grant full access to
        const resources = ['classes', 'students', 'teachers', 'subjects', 'attendance', 'fees'];
        const actions = ['create', 'read', 'update', 'delete', 'manage'];

        for (const resource of resources) {
            for (const action of actions) {
                // Find or create permission
                const [perm] = await Permission.findOrCreate({
                    where: { resource, action },
                    defaults: {
                        description: `Allow ${action} on ${resource}`
                    }
                });

                // Assign to role
                await RolePermission.findOrCreate({
                    where: {
                        roleId: role.id,
                        permissionId: perm.id
                    },
                    defaults: {
                        level: 'full',
                        effect: 'allow',
                        scope: 'tenant'
                    }
                });
                console.log(`➕ Granted ${resource}:${action} to ${roleCode}`);
            }
        }

        console.log('✅ Permissions seeded successfully!');

    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await sequelize.close();
    }
}

seedPermissions();
