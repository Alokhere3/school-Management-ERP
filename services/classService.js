const Class = require('../models/Class');

async function listClasses(tenantId, { page = 1, limit = 50, query = {} } = {}) {
    const maxLimit = 200;
    const safeLimit = Math.min(parseInt(limit, 10) || 20, maxLimit);
    const offset = (page - 1) * safeLimit;

    const where = { tenantId, ...query };
    const { count, rows } = await Class.findAndCountAll({ where, limit: safeLimit, offset, order: [['createdAt', 'DESC']] });
    return { count, rows };
}

async function createClass(data) {
    return Class.create(data);
}

async function getClassById(id, tenantId) {
    return Class.findOne({ where: { id, tenantId } });
}

async function updateClass(id, tenantId, updates) {
    const c = await getClassById(id, tenantId);
    if (!c) return null;
    const updated = await c.update(updates);
    return updated || c;
}

async function deleteClass(id, tenantId) {
    const c = await getClassById(id, tenantId);
    if (!c) return null;
    await c.destroy();
    return c;
}

module.exports = {
    listClasses,
    createClass,
    getClassById,
    updateClass,
    deleteClass
};
