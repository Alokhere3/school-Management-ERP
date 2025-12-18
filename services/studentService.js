const Student = require('../models/Student');

async function listStudents(tenantId, { page = 1, limit = 20, query = {} } = {}) {
    const maxLimit = 100; // Prevent excessive pagination
    const safeLimit = Math.min(parseInt(limit, 10) || 20, maxLimit);
    const offset = (page - 1) * safeLimit;
    
    try {
        const where = { tenantId, status: 'active', ...query };
        const { count, rows } = await Student.findAndCountAll({
            where,
            limit: safeLimit,
            offset,
            order: [['createdAt', 'DESC']], // Consistent ordering
            attributes: { exclude: ['onboardingData'] } // Exclude large JSON fields if not needed
        });
        return { count, rows };
    } catch (err) {
        // Log the full error for diagnostics
        const logger = require('../config/logger');
        logger.error('StudentService.listStudents DB error:', err && (err.stack || err));
        // attach some useful info to the thrown error for logging upstream
        const e = new Error('Database query failed: ' + (err && err.message));
        e.original = err;
        e.sql = err && err.sql;
        throw e;
    }
}

async function createStudent(data) {
    return Student.create(data);
}

async function getStudentById(id, tenantId) {
    return Student.findOne({ where: { id, tenantId } });
}

async function updateStudent(id, tenantId, updates) {
    const student = await getStudentById(id, tenantId);
    if (!student) return null;
    // prefer the result of update (some ORMs return updated instance)
    const updated = await student.update(updates);
    return updated || student;
}

async function deleteStudent(id, tenantId) {
    const student = await getStudentById(id, tenantId);
    if (!student) return null;
    await student.destroy();
    return student;
}

module.exports = {
    listStudents,
    createStudent,
    getStudentById,
    updateStudent,
    deleteStudent
};
