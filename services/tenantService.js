const Tenant = require('../models/Tenant');

async function listTenants() {
    return Tenant.findAll();
}

async function createTenant(payload) {
    return Tenant.create(payload);
}

async function getTenantById(id) {
    return Tenant.findByPk(id);
}

async function updateTenant(id, updates) {
    const t = await Tenant.findByPk(id);
    if (!t) return null;
    return t.update(updates);
}

async function deleteTenant(id) {
    const t = await Tenant.findByPk(id);
    if (!t) return null;
    await t.destroy();
    return t;
}

module.exports = {
    listTenants,
    createTenant,
    getTenantById,
    updateTenant,
    deleteTenant
};
