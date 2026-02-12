const { sequelize } = require('./config/database');
const { User, UserRole, Role, RolePermission, Permission } = require('./models');

async function debugPermissions() {
    try {
        const userId = 'ee7184cb-8810-4bbe-892c-c14a3c3c6c9f';
        const tenantId = '9fbb8d86-ce85-49ee-a521-e5e0fb2206c1';

        console.log(`Debugging user: ${userId}, Tenant: ${tenantId}`);

        // 1. Check UserRole
        const userRoles = await UserRole.findAll({ where: { userId, tenantId } });
        console.log('User Roles found:', userRoles.map(ur => ur.role));

        // 2. Check Teacher Role ID
        const teacherRole = await Role.findOne({ where: { name: 'Teacher', tenantId } });
        if (!teacherRole) {
            console.log('ERROR: Teacher role not found for tenant!');
            return;
        }
        console.log('Teacher Role ID:', teacherRole.id);

        // 3. Check Admissions Permissions for this Role
        const admissionsPerms = await Permission.findAll({ where: { resource: 'admissions' } });
        const permIds = admissionsPerms.map(p => p.id);

        const rolePerms = await RolePermission.findAll({
            where: {
                roleId: teacherRole.id,
                permissionId: permIds
            },
            include: [{ model: Permission, as: 'permission' }]
        });

        if (rolePerms.length === 0) {
            console.log('No RolePermissions found for Admissions for this role.');
        } else {
            console.log('Admissions Role Permissions:');
            rolePerms.forEach(rp => {
                console.log(`- ${rp.permission.action}: ${rp.level}`);
            });
        }

    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

debugPermissions();
