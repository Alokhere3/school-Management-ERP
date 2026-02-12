const { sequelize } = require('./config/database');
const { Tenant, Role, Permission, RolePermission } = require('./models');
const { ACCESS_MATRIX, LEVEL_TO_ACTIONS, mapLevelToPolicy } = require('./services/rolePermissionService');

async function updateAllRoles() {
    try {
        console.error('Starting permission update for existing roles...');

        const VALID_LEVELS = ['none', 'read', 'limited', 'full'];

        const tenants = await Tenant.findAll();
        console.error(`Found ${tenants.length} tenants.`);

        for (const tenant of tenants) {
            console.error(`Processing Tenant: ${tenant.name} (${tenant.id})`);

            for (const [roleName, moduleAccessMap] of Object.entries(ACCESS_MATRIX)) {

                const role = await Role.findOne({
                    where: {
                        name: roleName,
                        tenantId: tenant.id
                    }
                });

                if (!role) {
                    continue;
                }

                // console.error(`  Checking Role: ${roleName}`);

                for (const [module, level] of Object.entries(moduleAccessMap)) {
                    if (!VALID_LEVELS.includes(level)) continue;

                    const actions = LEVEL_TO_ACTIONS[level] || [];
                    const resourcePermissions = await Permission.findAll({
                        where: { resource: module }
                    });

                    for (const permission of resourcePermissions) {
                        const isAllowed = actions.includes(permission.action);
                        const targetLevel = isAllowed ? level : 'none';

                        if (isAllowed) {
                            const policy = mapLevelToPolicy(targetLevel);
                            const [rp, created] = await RolePermission.findOrCreate({
                                where: {
                                    roleId: role.id,
                                    permissionId: permission.id
                                },
                                defaults: {
                                    level: targetLevel,
                                    effect: policy.effect,
                                    scope: policy.scope,
                                    conditions: policy.conditions
                                }
                            });

                            if (!created && (
                                rp.level !== targetLevel ||
                                rp.effect !== policy.effect ||
                                rp.scope !== policy.scope ||
                                JSON.stringify(rp.conditions) !== JSON.stringify(policy.conditions)
                            )) {
                                console.error(`    Updating ${roleName} - ${module}:${permission.action} -> ${targetLevel}`);
                                await rp.update({
                                    level: targetLevel,
                                    effect: policy.effect,
                                    scope: policy.scope,
                                    conditions: policy.conditions
                                });
                            }
                        } else {
                            const destroyed = await RolePermission.destroy({
                                where: {
                                    roleId: role.id,
                                    permissionId: permission.id
                                }
                            });
                            if (destroyed > 0) {
                                // console.error(`    Removed ${roleName} - ${module}:${permission.action}`);
                            }
                        }
                    }
                }
            }
        }

        console.error('Permission update completed successfully.');

    } catch (error) {
        console.error('Error updating permissions:', error);
    } finally {
        await sequelize.close();
    }
}

updateAllRoles();
