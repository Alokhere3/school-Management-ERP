const asyncHandler = require('../utils/asyncHandler');
const classService = require('../services/classService');
const { sendError } = require('../utils/errorMapper');

// List classes (accessible to tenant users; RBAC will have validated read permission)
const listClasses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) return sendError(res, { status: 400, body: { success: false, error: 'tenantId missing', code: 'TENANT_REQUIRED' } });

    const { count, rows } = await classService.listClasses(tenantId, { page, limit });
    res.json({ success: true, data: rows, pagination: { total: count, pages: Math.ceil(count / limit), current: Number(page) } });
});

// Create class (Admin only)
const createClass = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) return sendError(res, { status: 400, body: { success: false, error: 'tenantId missing', code: 'TENANT_REQUIRED' } });

    // Prevent super admin (global) managing tenant classes
    const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
    if (userRoles.some(r => typeof r === 'string' && r.toLowerCase().includes('super'))) {
        return res.status(403).json({ success: false, error: 'Super admin cannot manage tenant classes' });
    }

    const payload = {
        tenantId,
        className: req.body.className,
        section: req.body.section || null,
        noOfStudents: req.body.noOfStudents || 0,
        noOfSubjects: req.body.noOfSubjects || 0,
        status: req.body.status || 'active'
    };

    const created = await classService.createClass(payload);
    res.status(201).json({ success: true, data: created });
});

const getClassById = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    const id = req.params.id;
    const c = await classService.getClassById(id, tenantId);
    if (!c) return res.status(404).json({ success: false, error: 'Class not found' });
    res.json({ success: true, data: c });
});

const updateClass = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    const id = req.params.id;

    const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
    if (userRoles.some(r => typeof r === 'string' && r.toLowerCase().includes('super'))) {
        return res.status(403).json({ success: false, error: 'Super admin cannot manage tenant classes' });
    }

    const updates = {
        className: req.body.className,
        section: req.body.section,
        noOfStudents: req.body.noOfStudents,
        noOfSubjects: req.body.noOfSubjects,
        status: req.body.status
    };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    const updated = await classService.updateClass(id, tenantId, updates);
    if (!updated) return res.status(404).json({ success: false, error: 'Class not found' });
    res.json({ success: true, data: updated });
});

const deleteClass = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    const id = req.params.id;

    const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
    if (userRoles.some(r => typeof r === 'string' && r.toLowerCase().includes('super'))) {
        return res.status(403).json({ success: false, error: 'Super admin cannot manage tenant classes' });
    }

    const deleted = await classService.deleteClass(id, tenantId);
    if (!deleted) return res.status(404).json({ success: false, error: 'Class not found' });
    res.status(204).json();
});

module.exports = {
    listClasses,
    createClass,
    getClassById,
    updateClass,
    deleteClass
};
