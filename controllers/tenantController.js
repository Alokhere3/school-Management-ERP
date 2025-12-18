const tenantService = require('../services/tenantService');
const asyncHandler = require('../utils/asyncHandler');

exports.listTenants = asyncHandler(async (req, res) => {
    const tenants = await tenantService.listTenants();
    res.json({ success: true, data: tenants });
});

exports.createTenant = asyncHandler(async (req, res) => {
    const payload = { name: req.body.name, slug: req.body.slug };
    const created = await tenantService.createTenant(payload);
    res.status(201).json({ success: true, data: created });
});

exports.getTenantById = asyncHandler(async (req, res) => {
    const t = await tenantService.getTenantById(req.params.id);
    if (!t) return res.status(404).json({ success: false, error: 'Tenant not found' });
    res.json({ success: true, data: t });
});

exports.updateTenant = asyncHandler(async (req, res) => {
    const updated = await tenantService.updateTenant(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Tenant not found' });
    res.json({ success: true, data: updated });
});

exports.deleteTenant = asyncHandler(async (req, res) => {
    const deleted = await tenantService.deleteTenant(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Tenant not found' });
    res.status(204).end();
});
