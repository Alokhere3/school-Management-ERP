const asyncHandler = require('../utils/asyncHandler');
const { RepositoryFactory } = require('../repositories');
const { extractKeyFromUrl, buildProxyUrl, validateExtensionForCategory } = require('../utils/s3Helper');
const { sendError } = require('../utils/errorMapper');
const { s3Client, bucket: S3_BUCKET, uploadBufferToS3 } = require('../config/s3');

/**
 * Helper: Apply row-level security filtering based on permission level
 * level === 'limited' means user should only see own records
 */
function applyRowLevelSecurity(query, userContext) {
    // If permission level is limited (set by RBAC middleware), restrict to own record
    const permissionLevel = (userContext && userContext.permission && userContext.permission.level) || null;
    const role = (userContext && userContext.role) || '';
    const userId = userContext && userContext.userId;

    if (permissionLevel === 'limited') {
        if (!/hr/i.test(role)) {
            // Non-HR limited users only see their own record
            query.userId = userId;
        }
    }
    return query;
}

// Repository factory instance
const repos = new RepositoryFactory();

// GET /api/staff
const listStaff = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, department, role, designation } = req.query;
    const userContext = req.userContext || req.user;
    const tenantId = userContext && userContext.tenantId;
    if (!tenantId) {
        return sendError(res, { 
            status: 400, 
            body: { success: false, error: 'tenantId missing from token', code: 'TENANT_REQUIRED' } 
        });
    }
    
    try {
        // Apply row-level security
        const query = { tenantId };
        applyRowLevelSecurity(query, userContext);
        
        // Add filters
        if (department) query.department = department;
        if (role) query.role = role;
        if (designation) query.designation = designation;
        
        const options = { page: Number(page), limit: Number(limit) };
        const { count, rows } = await repos.staff.findVisibleStaff(userContext, query, options);
        
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
    const userContext = req.userContext || req.user;
    const tenantId = userContext && userContext.tenantId;
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
        // Photo/Docs will be uploaded after record creation (so we have entityId)
        photoKey: null,
        resumeKey: null,
        joiningLetterKey: null,
        status: 'active'
    };
    
    // Remove undefined fields
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    
    // Create staff first (no files yet)
    const staff = await repos.staff.createStaff(payload, userContext);
    const s = staff.toJSON ? staff.toJSON() : staff;

    // If multipart files were provided (memory), upload them to S3 using the staff id
    if (req.files && Object.keys(req.files).length > 0) {
        const uploads = {};
        // photo
        if (req.files.photo && req.files.photo[0] && req.files.photo[0].buffer) {
            const file = req.files.photo[0];
            if (!validateExtensionForCategory(file.originalname, 'profile')) {
                return sendError(res, { status: 400, body: { success: false, error: 'Invalid photo type', code: 'VALIDATION_ERROR' } });
            }
            const key = require('../utils/s3Helper').generateS3Key(userContext.tenantId, 'staff', s.id, 'photo', file.originalname);
            await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
            uploads.photoKey = key;
        }
        // resume
        if (req.files.resume && req.files.resume[0] && req.files.resume[0].buffer) {
            const file = req.files.resume[0];
            if (!validateExtensionForCategory(file.originalname, 'resume')) {
                return sendError(res, { status: 400, body: { success: false, error: 'Invalid resume type', code: 'VALIDATION_ERROR' } });
            }
            const key = require('../utils/s3Helper').generateS3Key(userContext.tenantId, 'staff', s.id, 'resume', file.originalname);
            await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
            uploads.resumeKey = key;
        }
        // joiningLetter
        if (req.files.joiningLetter && req.files.joiningLetter[0] && req.files.joiningLetter[0].buffer) {
            const file = req.files.joiningLetter[0];
            if (!validateExtensionForCategory(file.originalname, 'joining_letter')) {
                return sendError(res, { status: 400, body: { success: false, error: 'Invalid joining letter type', code: 'VALIDATION_ERROR' } });
            }
            const key = require('../utils/s3Helper').generateS3Key(userContext.tenantId, 'staff', s.id, 'joining_letter', file.originalname);
            await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
            uploads.joiningLetterKey = key;
        }

        if (Object.keys(uploads).length > 0) {
            await repos.staff.updateStaff(s.id, uploads, userContext);
            // refresh staff
            const refreshed = await repos.staff.findStaffById(s.id, userContext);
            const sr = refreshed.toJSON ? refreshed.toJSON() : refreshed;
            if (sr.photoKey) sr.photoUrl = buildProxyUrl(sr.photoKey);
            if (sr.resumeKey) sr.resumeUrl = buildProxyUrl(sr.resumeKey);
            if (sr.joiningLetterKey) sr.joiningLetterUrl = buildProxyUrl(sr.joiningLetterKey);
            return res.status(201).json({ success: true, data: sr });
        }

    }

    // No multipart files uploaded - return created staff
    if (s.photoKey) s.photoUrl = buildProxyUrl(s.photoKey);
    if (s.resumeKey) s.resumeUrl = buildProxyUrl(s.resumeKey);
    if (s.joiningLetterKey) s.joiningLetterUrl = buildProxyUrl(s.joiningLetterKey);

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
    
    // Handle multipart file uploads (memory buffers) - upload to S3 and update keys
    if (req.files && Object.keys(req.files).length > 0) {
        const uploads = {};
        const staffId = req.params.id;
        const existing = await repos.staff.findStaffById(staffId, userContext);

        // photo
        if (req.files.photo && req.files.photo[0] && req.files.photo[0].buffer) {
            const file = req.files.photo[0];
            if (!validateExtensionForCategory(file.originalname, 'profile')) {
                return sendError(res, { status: 400, body: { success: false, error: 'Invalid photo type', code: 'VALIDATION_ERROR' } });
            }
            const key = require('../utils/s3Helper').generateS3Key(userContext.tenantId, 'staff', staffId, 'photo', file.originalname);
            await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
            // delete old
            try {
                if (existing && existing.photoKey && existing.photoKey !== key && existing.photoKey.includes(`tenants/${userContext.tenantId}`)) {
                    await require('../utils/s3Helper').deleteS3Object(s3Client, S3_BUCKET, existing.photoKey, userContext.tenantId, { userId: userContext.userId, entityId: staffId, entityType: 'staff', category: 'photo', action: 'DELETE_OLD_ON_UPDATE' });
                }
            } catch (e) {
                // log and continue
            }
            uploads.photoKey = key;
        }

        // resume
        if (req.files.resume && req.files.resume[0] && req.files.resume[0].buffer) {
            const file = req.files.resume[0];
            if (!validateExtensionForCategory(file.originalname, 'resume')) {
                return sendError(res, { status: 400, body: { success: false, error: 'Invalid resume type', code: 'VALIDATION_ERROR' } });
            }
            const key = require('../utils/s3Helper').generateS3Key(userContext.tenantId, 'staff', staffId, 'resume', file.originalname);
            await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
            try {
                if (existing && existing.resumeKey && existing.resumeKey !== key && existing.resumeKey.includes(`tenants/${userContext.tenantId}`)) {
                    await require('../utils/s3Helper').deleteS3Object(s3Client, S3_BUCKET, existing.resumeKey, userContext.tenantId, { userId: userContext.userId, entityId: staffId, entityType: 'staff', category: 'resume', action: 'DELETE_OLD_ON_UPDATE' });
                }
            } catch (e) {}
            uploads.resumeKey = key;
        }

        // joiningLetter
        if (req.files.joiningLetter && req.files.joiningLetter[0] && req.files.joiningLetter[0].buffer) {
            const file = req.files.joiningLetter[0];
            if (!validateExtensionForCategory(file.originalname, 'joining_letter')) {
                return sendError(res, { status: 400, body: { success: false, error: 'Invalid joining letter type', code: 'VALIDATION_ERROR' } });
            }
            const key = require('../utils/s3Helper').generateS3Key(userContext.tenantId, 'staff', staffId, 'joining_letter', file.originalname);
            await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
            try {
                if (existing && existing.joiningLetterKey && existing.joiningLetterKey !== key && existing.joiningLetterKey.includes(`tenants/${userContext.tenantId}`)) {
                    await require('../utils/s3Helper').deleteS3Object(s3Client, S3_BUCKET, existing.joiningLetterKey, userContext.tenantId, { userId: userContext.userId, entityId: staffId, entityType: 'staff', category: 'joining_letter', action: 'DELETE_OLD_ON_UPDATE' });
                }
            } catch (e) {}
            uploads.joiningLetterKey = key;
        }

        Object.assign(updates, uploads);
    }
    
    // Remove undefined fields
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
    
    const staff = await repos.staff.updateStaff(req.params.id, updates, userContext);
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
    
    const staff = await repos.staff.findStaffById(req.params.id, userContext);
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
    
    const staff = await repos.staff.deleteStaff(req.params.id, userContext);
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

