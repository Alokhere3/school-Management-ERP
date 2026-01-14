const tenantService = require('../services/tenantService');
const asyncHandler = require('../utils/asyncHandler');

function isSuperAdmin(userContext) {
    if (!userContext) return false;
    const roles = userContext.roles || (userContext.role ? [userContext.role] : []);
    return roles.some(r => String(r).toLowerCase().includes('super'));
}

exports.listTenants = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    if (!userContext || !isSuperAdmin(userContext)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const tenants = await tenantService.listTenants();
    res.json({ success: true, data: tenants });
});

exports.createTenant = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    if (!userContext || !isSuperAdmin(userContext)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const payload = { name: req.body.name, slug: req.body.slug };
    const created = await tenantService.createTenant(payload);
    res.status(201).json({ success: true, data: created });
});

exports.getTenantById = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    if (!userContext || !isSuperAdmin(userContext)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const t = await tenantService.getTenantById(req.params.id);
    if (!t) return res.status(404).json({ success: false, error: 'Tenant not found' });
    res.json({ success: true, data: t });
});

exports.updateTenant = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    if (!userContext || !isSuperAdmin(userContext)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const updated = await tenantService.updateTenant(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Tenant not found' });
    res.json({ success: true, data: updated });
});

exports.deleteTenant = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    if (!userContext || !isSuperAdmin(userContext)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const deleted = await tenantService.deleteTenant(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Tenant not found' });
    res.status(204).end();
});
