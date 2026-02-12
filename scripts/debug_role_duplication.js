const { sequelize } = require('../config/database');
const { Role, UserRole, Permission, RolePermission } = require('../models');
const { Op } = require('sequelize');

async function debugRoles() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const roleCode = 'SCHOOL_ADMIN_GLOBAL';
        const userId = 'b3ba4904-b097-4cd2-8fea-8ce7a08f5770'; // From user logs

        // 1. Find ALL roles with this code
        const roles = await Role.findAll({
            where: { code: roleCode }
        });

        console.log(`\n🔎 Found ${roles.length} roles with code '${roleCode}':`);
        roles.forEach(r => {
            console.log(` - ID: ${r.id} | Name: ${r.name} | Tenant: ${r.tenantId} | IsSystem: ${r.isSystemRole}`);
        });

        // 2. Check which role the user has
        const userRoles = await UserRole.findAll({
            where: { userId },
            include: [{ model: Role, as: 'roleDetail' }]
        });

        console.log(`\n👤 User ${userId} has roles:`);
        userRoles.forEach(ur => {
            console.log(` - RoleCode: ${ur.roleDetail.code} | RoleID: ${ur.roleId} | Tenant: ${ur.tenantId}`);
        });

        // 3. Check permissions for EACH found role ID
        console.log(`\n🔑 Permissions for roles:`);
        for (const r of roles) {
            const perms = await RolePermission.count({
                where: { roleId: r.id }
            });
            console.log(` - Role ID ${r.id}: ${perms} permissions`);

            // Sample verify
            const sample = await RolePermission.findOne({
                where: { roleId: r.id },
                include: [{
                    model: Permission,
                    as: 'permission',
                    where: { resource: 'students', action: 'read' }
                }]
            });
            if (sample) {
                console.log(`   ✅ Has students:read`);
            } else {
                console.log(`   ❌ MISSING students:read`);
            }
        }

    } catch (error) {
        console.error('Debug failed:', error);
    } finally {
        await sequelize.close();
    }
}

debugRoles();
