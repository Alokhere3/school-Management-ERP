const { sequelize } = require('../config/database');
const { Role, Permission, RolePermission } = require('../models');
const { Op } = require('sequelize');

async function checkPermissions() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const roleCode = 'SCHOOL_ADMIN_GLOBAL'; // The role causing issues

        const role = await Role.findOne({
            where: { code: roleCode }
        });

        if (!role) {
            console.error(`❌ Role '${roleCode}' not found in DB!`);
            return;
        }

        console.log(`✅ Found Role: ${role.name} (ID: ${role.id})`);

        const perms = await RolePermission.findAll({
            where: { roleId: role.id },
            include: [{ model: Permission, as: 'permission' }]
        });

        if (perms.length === 0) {
            console.warn(`⚠️ No permissions found for role '${roleCode}'`);
        } else {
            console.log(`ℹ️ Permissions for '${roleCode}':`);
            perms.forEach(rp => {
                console.log(` - ${rp.permission.resource}:${rp.permission.action} -> ${rp.level || 'policy'}`);
            });
        }

        // Specific check for classes:read
        const hasClassRead = perms.find(rp => rp.permission.resource === 'classes' && rp.permission.action === 'read');
        if (hasClassRead) {
            console.log('✅ Has classes:read permission');
        } else {
            console.error('❌ MISSING classes:read permission');
        }

    } catch (error) {
        console.error('Diagnostic failed:', error);
    } finally {
        await sequelize.close();
    }
}

checkPermissions();
