const { sequelize } = require('./config/database');
const { Role, Permission, RolePermission } = require('./models');

async function forceFixTeacherAdmissions() {
    try {
        const tenantId = '9fbb8d86-ce85-49ee-a521-e5e0fb2206c1';
        const roleName = 'Teacher';

        console.log(`Fixing ${roleName} permissions for Tenant ${tenantId}`);

        const role = await Role.findOne({
            where: { name: roleName, tenantId }
        });

        if (!role) {
            console.error('Role not found!');
            return;
        }

        console.log('Role ID:', role.id);

        const permission = await Permission.findOne({
            where: { resource: 'admissions', action: 'read' }
        });

        if (!permission) {
            console.error('Permission admissions:read not found!');
            return;
        }

        console.log('Permission ID:', permission.id);

        const [rp, created] = await RolePermission.findOrCreate({
            where: {
                roleId: role.id,
                permissionId: permission.id
            },
            defaults: {
                level: 'limited'
            }
        });

        console.log('RolePermission result:', created ? 'Created' : 'Found existing');
        console.log('Current Level:', rp.level);

        if (rp.level !== 'limited') {
            console.log('Updating level to limited...');
            await rp.update({ level: 'limited' });
            console.log('Updated.');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

forceFixTeacherAdmissions();
