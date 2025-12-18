const asyncHandler = require('../utils/asyncHandler');
const staffService = require('../services/staffService');
const { extractKeyFromUrl, buildProxyUrl } = require('../utils/s3Helper');
const { sendError } = require('../utils/errorMapper');

/**
 * Helper: Apply row-level security filtering based on permission level
 * level === 'limited' means user should only see own records
 */
function applyRowLevelSecurity(query, req) {
    if (req.permission && req.permission.level === 'limited') {
        // HR staff see only their own records or their department
        if (req.user.role === 'HR Manager' || req.user.role === 'hr_manager') {
            // Can see all staff in their tenant (HR Manager has broader access)
            // But if limited, might restrict to department
            // For now, allow all in tenant for HR Manager
        } else {
            // Other roles see only their own record
            query.userId = req.user.id;
        }
    }
    return query;
}

// GET /api/staff
const listStaff = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, department, role, designation } = req.query;
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) {
        return sendError(res, { 
            status: 400, 
            body: { success: false, error: 'tenantId missing from token', code: 'TENANT_REQUIRED' } 
        });
    }
    
    try {
        // Apply row-level security
        const query = { tenantId };
        applyRowLevelSecurity(query, req);
        
        // Add filters
        if (department) query.department = department;
        if (role) query.role = role;
        if (designation) query.designation = designation;
        
        const { count, rows } = await staffService.listStaff(tenantId, { page, limit, query });
        
        // Convert S3 URLs to proxy URLs
        const dataWithProxyUrls = rows.map((staff) => {
            const s = staff.toJSON ? staff.toJSON() : staff;
            
            // Photo URL
            let key = s.photoKey;
            if (!key && s.photoUrl) {
                key = extractKeyFromUrl(s.photoUrl);
            }
            if (key) {
                s.photoUrl = buildProxyUrl(key);
            } else {
                s.photoUrl = null;
            }
            
            // Resume URL
            if (s.resumeKey) {
                s.resumeUrl = buildProxyUrl(s.resumeKey);
            }
            
            // Joining Letter URL
            if (s.joiningLetterKey) {
                s.joiningLetterUrl = buildProxyUrl(s.joiningLetterKey);
            }
            
            return s;
        });
        
        res.json({ 
            success: true, 
            data: dataWithProxyUrls, 
            pagination: { 
                total: count, 
                pages: Math.ceil(count / limit), 
                current: Number(page) 
            } 
        });
    } catch (err) {
        const logger = require('../config/logger');
        logger.error('Error listing staff:', err && (err.sql || err.message || err));
        return sendError(res, err, 'Failed to list staff');
    }
});

// POST /api/staff
const createStaff = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) {
        return sendError(res, { 
            status: 400, 
            body: { success: false, error: 'tenantId missing', code: 'TENANT_REQUIRED' } 
        });
    }
    
    const payload = {
        tenantId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: req.body.role,
        department: req.body.department,
        designation: req.body.designation,
        gender: req.body.gender,
        primaryContactNumber: req.body.primaryContactNumber,
        email: req.body.email,
        bloodGroup: req.body.bloodGroup,
        maritalStatus: req.body.maritalStatus,
        fathersName: req.body.fathersName,
        mothersName: req.body.mothersName,
        dateOfBirth: req.body.dateOfBirth,
        dateOfJoining: req.body.dateOfJoining,
        languageKnown: req.body.languageKnown ? (Array.isArray(req.body.languageKnown) ? req.body.languageKnown : [req.body.languageKnown]) : null,
        qualification: req.body.qualification,
        workExperience: req.body.workExperience,
        note: req.body.note,
        address: req.body.address,
        permanentAddress: req.body.permanentAddress,
        // Payroll
        epfNo: req.body.epfNo,
        basicSalary: req.body.basicSalary,
        contractType: req.body.contractType,
        workShift: req.body.workShift,
        workLocation: req.body.workLocation,
        // Leaves
        medicalLeaves: req.body.medicalLeaves || 0,
        casualLeaves: req.body.casualLeaves || 0,
        maternityLeaves: req.body.maternityLeaves || 0,
        sickLeaves: req.body.sickLeaves || 0,
        // Bank
        accountName: req.body.accountName,
        accountNumber: req.body.accountNumber,
        bankName: req.body.bankName,
        ifscCode: req.body.ifscCode,
        branchName: req.body.branchName,
        // Transport
        transportEnabled: req.body.transportEnabled || false,
        transportRoute: req.body.transportRoute,
        vehicleNumber: req.body.vehicleNumber,
        pickupPoint: req.body.pickupPoint,
        // Hostel
        hostelEnabled: req.body.hostelEnabled || false,
        hostelName: req.body.hostelName,
        roomNo: req.body.roomNo,
        // Social Media
        facebookUrl: req.body.facebookUrl,
        twitterUrl: req.body.twitterUrl,
        linkedinUrl: req.body.linkedinUrl,
        instagramUrl: req.body.instagramUrl,
        // Photo
        photoUrl: req.files?.photo ? req.files.photo[0]?.location : null,
        photoKey: req.files?.photo ? (req.files.photo[0]?.key || null) : null,
        // Documents
        resumeUrl: req.files?.resume ? req.files.resume[0]?.location : null,
        resumeKey: req.files?.resume ? (req.files.resume[0]?.key || null) : null,
        joiningLetterUrl: req.files?.joiningLetter ? req.files.joiningLetter[0]?.location : null,
        joiningLetterKey: req.files?.joiningLetter ? (req.files.joiningLetter[0]?.key || null) : null,
        status: 'active'
    };
    
    // Remove undefined fields
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    
    const staff = await staffService.createStaff(payload);
    const s = staff.toJSON ? staff.toJSON() : staff;
    
    // Convert S3 URLs to proxy URLs
    if (s.photoKey) {
        s.photoUrl = buildProxyUrl(s.photoKey);
    }
    if (s.resumeKey) {
        s.resumeUrl = buildProxyUrl(s.resumeKey);
    }
    if (s.joiningLetterKey) {
        s.joiningLetterUrl = buildProxyUrl(s.joiningLetterKey);
    }
    
    res.status(201).json({ success: true, data: s });
});

// PUT /api/staff/:id
const updateStaff = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) {
        return sendError(res, { 
            status: 400, 
            body: { success: false, error: 'tenantId missing', code: 'TENANT_REQUIRED' } 
        });
    }
    
    const updates = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: req.body.role,
        department: req.body.department,
        designation: req.body.designation,
        gender: req.body.gender,
        primaryContactNumber: req.body.primaryContactNumber,
        email: req.body.email,
        bloodGroup: req.body.bloodGroup,
        maritalStatus: req.body.maritalStatus,
        fathersName: req.body.fathersName,
        mothersName: req.body.mothersName,
        dateOfBirth: req.body.dateOfBirth,
        dateOfJoining: req.body.dateOfJoining,
        languageKnown: req.body.languageKnown,
        qualification: req.body.qualification,
        workExperience: req.body.workExperience,
        note: req.body.note,
        address: req.body.address,
        permanentAddress: req.body.permanentAddress,
        epfNo: req.body.epfNo,
        basicSalary: req.body.basicSalary,
        contractType: req.body.contractType,
        workShift: req.body.workShift,
        workLocation: req.body.workLocation,
        medicalLeaves: req.body.medicalLeaves,
        casualLeaves: req.body.casualLeaves,
        maternityLeaves: req.body.maternityLeaves,
        sickLeaves: req.body.sickLeaves,
        accountName: req.body.accountName,
        accountNumber: req.body.accountNumber,
        bankName: req.body.bankName,
        ifscCode: req.body.ifscCode,
        branchName: req.body.branchName,
        transportEnabled: req.body.transportEnabled,
        transportRoute: req.body.transportRoute,
        vehicleNumber: req.body.vehicleNumber,
        pickupPoint: req.body.pickupPoint,
        hostelEnabled: req.body.hostelEnabled,
        hostelName: req.body.hostelName,
        roomNo: req.body.roomNo,
        facebookUrl: req.body.facebookUrl,
        twitterUrl: req.body.twitterUrl,
        linkedinUrl: req.body.linkedinUrl,
        instagramUrl: req.body.instagramUrl
    };
    
    // Handle file uploads - support both single and multiple file uploads
    if (req.files?.photo && req.files.photo[0]) {
        updates.photoUrl = req.files.photo[0].location;
        updates.photoKey = req.files.photo[0].key;
    }
    if (req.files?.resume && req.files.resume[0]) {
        updates.resumeUrl = req.files.resume[0].location;
        updates.resumeKey = req.files.resume[0].key;
    }
    if (req.files?.joiningLetter && req.files.joiningLetter[0]) {
        updates.joiningLetterUrl = req.files.joiningLetter[0].location;
        updates.joiningLetterKey = req.files.joiningLetter[0].key;
    }
    
    // Remove undefined fields
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
    
    const staff = await staffService.updateStaff(req.params.id, tenantId, updates);
    if (!staff) {
        return res.status(404).json({ success: false, error: 'Staff not found' });
    }
    
    const s = staff.toJSON ? staff.toJSON() : staff;
    
    // Convert S3 URLs to proxy URLs
    if (s.photoKey) {
        s.photoUrl = buildProxyUrl(s.photoKey);
    }
    if (s.resumeKey) {
        s.resumeUrl = buildProxyUrl(s.resumeKey);
    }
    if (s.joiningLetterKey) {
        s.joiningLetterUrl = buildProxyUrl(s.joiningLetterKey);
    }
    
    res.json({ success: true, data: s });
});

// GET /api/staff/:id
const getStaffById = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) {
        return sendError(res, { 
            status: 400, 
            body: { success: false, error: 'tenantId missing', code: 'TENANT_REQUIRED' } 
        });
    }
    
    const staff = await staffService.getStaffById(req.params.id, tenantId);
    if (!staff) {
        return res.status(404).json({ success: false, error: 'Staff not found' });
    }
    
    // Check row-level security
    if (req.permission && req.permission.level === 'limited') {
        if (staff.userId && staff.userId !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied: You can only view your own record' 
            });
        }
    }
    
    const s = staff.toJSON ? staff.toJSON() : staff;
    
    // Convert S3 URLs to proxy URLs
    if (s.photoKey) {
        s.photoUrl = buildProxyUrl(s.photoKey);
    }
    if (s.resumeKey) {
        s.resumeUrl = buildProxyUrl(s.resumeKey);
    }
    if (s.joiningLetterKey) {
        s.joiningLetterUrl = buildProxyUrl(s.joiningLetterKey);
    }
    
    res.json({ success: true, data: s });
});

// DELETE /api/staff/:id
const deleteStaff = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) {
        return sendError(res, { 
            status: 400, 
            body: { success: false, error: 'tenantId missing', code: 'TENANT_REQUIRED' } 
        });
    }
    
    const staff = await staffService.deleteStaff(req.params.id, tenantId);
    if (!staff) {
        return res.status(404).json({ success: false, error: 'Staff not found' });
    }
    
    res.status(204).json();
});

module.exports = {
    listStaff,
    createStaff,
    updateStaff,
    getStaffById,
    deleteStaff
};

