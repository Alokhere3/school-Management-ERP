const Staff = require('../models/Staff');

async function listStaff(tenantId, { page = 1, limit = 20, query = {} } = {}) {
    const maxLimit = 100;
    const safeLimit = Math.min(parseInt(limit, 10) || 20, maxLimit);
    const offset = (page - 1) * safeLimit;
    
    try {
        const where = { tenantId, status: 'active', ...query };
        const { count, rows } = await Staff.findAndCountAll({
            where,
            limit: safeLimit,
            offset,
            order: [['createdAt', 'DESC']],
            attributes: { exclude: ['resumeKey', 'joiningLetterKey'] } // Exclude sensitive keys
        });
        return { count, rows };
    } catch (err) {
        const logger = require('../config/logger');
        logger.error('StaffService.listStaff DB error:', err && (err.stack || err));
        const e = new Error('Database query failed: ' + (err && err.message));
        e.original = err;
        e.sql = err && err.sql;
        throw e;
    }
}

async function createStaff(data) {
    return Staff.create(data);
}

async function getStaffById(id, tenantId) {
    return Staff.findOne({ 
        where: { id, tenantId },
        attributes: { exclude: ['resumeKey', 'joiningLetterKey'] }
    });
}

async function updateStaff(id, tenantId, updates) {
    const staff = await getStaffById(id, tenantId);
    if (!staff) return null;
    const updated = await staff.update(updates);
    return updated || staff;
}

async function deleteStaff(id, tenantId) {
    const staff = await getStaffById(id, tenantId);
    if (!staff) return null;
    // Soft delete - set status to inactive
    await staff.update({ status: 'inactive' });
    return staff;
}

module.exports = {
    listStaff,
    createStaff,
    getStaffById,
    updateStaff,
    deleteStaff
};

