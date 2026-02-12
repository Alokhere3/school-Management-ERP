#!/usr/bin/env node

/**
 * Permissions Sanity Check
 *
 * Verifies:
 * - All permissions exist for modules/actions in ACCESS_MATRIX
 * - RolePermissions exist for expected role/module/action pairs
 * - RolePermissions have effect/scope populated
 *
 * Usage:
 *   node scripts/permissions_sanity_check.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sequelize } = require('../config/database');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const { ACCESS_MATRIX, LEVEL_TO_ACTIONS } = require('../services/rolePermissionService');

const ACTIONS = ['create', 'read', 'update', 'delete', 'export'];

function buildModuleList() {
    const modules = new Set();
    Object.values(ACCESS_MATRIX).forEach(moduleMap => {
        Object.keys(moduleMap).forEach(m => modules.add(m));
    });
    return Array.from(modules).sort();
}

async function main() {
    const failures = [];
    const warnings = [];
    const modules = buildModuleList();

    try {
        await sequelize.authenticate();

        // 1) Ensure permissions exist for all module/action pairs we expect
        const perms = await Permission.findAll({
            attributes: ['id', 'resource', 'action'],
            raw: true
        });
        const permSet = new Set(perms.map(p => `${p.resource}:${p.action}`));

        for (const module of modules) {
            for (const action of ACTIONS) {
                const key = `${module}:${action}`;
                if (!permSet.has(key)) {
                    failures.push(`Missing permission: ${key}`);
                }
            }
        }

        // 2) Validate role permissions for tenant roles
        const roles = await Role.findAll({
            attributes: ['id', 'name', 'tenantId', 'isSystemRole'],
            raw: true
        });

        for (const role of roles) {
            const matrix = ACCESS_MATRIX[role.name];

            if (!matrix) {
                // Skip system roles or custom roles
                warnings.push(`No ACCESS_MATRIX entry for role '${role.name}' (tenantId=${role.tenantId || 'null'})`);
                continue;
            }

            for (const [module, level] of Object.entries(matrix)) {
                const actions = LEVEL_TO_ACTIONS[level] || [];

                for (const action of actions) {
                    const permKey = `${module}:${action}`;
                    const permission = perms.find(p => p.resource === module && p.action === action);
                    if (!permission) {
                        failures.push(`Permission not found in DB for ${permKey}`);
                        continue;
                    }

                    const rp = await RolePermission.findOne({
                        where: { roleId: role.id, permissionId: permission.id },
                        attributes: ['id', 'effect', 'scope', 'conditions'],
                        raw: true
                    });

                    if (!rp) {
                        failures.push(`Missing RolePermission: role=${role.name} (${role.id}) -> ${permKey}`);
                        continue;
                    }

                    if (!rp.effect || !rp.scope) {
                        failures.push(`RolePermission missing effect/scope: role=${role.name} -> ${permKey}`);
                    }
                }
            }
        }

        // Report
        console.log('\n=== Permissions Sanity Check ===');
        if (warnings.length > 0) {
            console.log('\nWarnings:');
            warnings.forEach(w => console.log(`- ${w}`));
        }

        if (failures.length > 0) {
            console.log('\nFailures:');
            failures.forEach(f => console.log(`- ${f}`));
            console.log(`\n❌ Failed with ${failures.length} issue(s).`);
            process.exit(1);
        }

        console.log('\n✅ Permissions sanity check passed.');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Permissions sanity check error:', err.message);
        process.exit(1);
    } finally {
        try { await sequelize.close(); } catch (_) {}
    }
}

if (require.main === module) {
    main();
}

