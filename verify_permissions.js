const { sequelize } = require('./config/database');
const { Tenant, Role, RolePermission, Permission } = require('./models');

async function checkTeacherPermissions() {
    try {
        const role = await Role.findOne({ where: { name: 'Teacher' } });
        if (!role) {
            console.log('Teacher role not found');
            return;
        }

        const permissions = await RolePermission.findAll({
            where: { roleId: role.id },
            include: [{ model: Permission, where: { resource: 'admissions' } }]
        });

        console.log(`Teacher Role (${role.id}) Permissions for 'admissions':`);
        permissions.forEach(p => {
            console.log(`- Action: ${p.permission.action}, Level: ${p.level}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

checkTeacherPermissions();
