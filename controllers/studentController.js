const asyncHandler = require('../utils/asyncHandler');
const studentService = require('../services/studentService');
const { buildProxyUrl, generateS3Key, validateExtensionForCategory } = require('../utils/s3Helper');
const { sendError } = require('../utils/errorMapper');
const { RepositoryFactory } = require('../repositories');
const { s3Client, bucket: S3_BUCKET, uploadBufferToS3 } = require('../config/s3');
const logger = require('../config/logger');

// Initialize repository factory for student data access
const repos = new RepositoryFactory();

/**
 * Fetch class data and denormalize it for storage
 */
/**
 * Fetch and denormalize class information for storage
 * This prevents the need for separate API calls to get class details
 */
const getClassDataForStudent = async (classId, userContext) => {
    if (!classId) {
        return null;
    }
    
    try {
        console.log(`[CLASS_FETCH] Fetching class ${classId} for student`);
        
        // Try using the repository first (RLS-aware)
        try {
            const classRecord = await repos.class.findClassById(classId, userContext);
            
            if (classRecord) {
                const classData = classRecord.toJSON ? classRecord.toJSON() : classRecord;
                const denormalizedData = {
                    id: classData.id,
                    name: classData.name,
                    section: classData.section,
                    academicYear: classData.academicYear,
                    classTeacherId: classData.classTeacherId
                };
                console.log(`[CLASS_FETCH] ✅ Fetched via repository:`, denormalizedData);
                return denormalizedData;
            }
        } catch (repoErr) {
            console.warn(`[CLASS_FETCH] Repository fetch failed:`, repoErr.message);
        }
        
        // Fallback: Direct model query (less secure but guaranteed to work if class exists)
        console.log(`[CLASS_FETCH] Trying direct model query as fallback...`);
        const Class = require('../models/Class');
        const classRecord = await Class.findOne({
            where: { id: classId, tenantId: userContext.tenantId },
            raw: true
        });
        
        if (classRecord) {
            const denormalizedData = {
                id: classRecord.id,
                name: classRecord.name,
                section: classRecord.section,
                academicYear: classRecord.academicYear,
                classTeacherId: classRecord.classTeacherId
            };
            console.log(`[CLASS_FETCH] ✅ Fetched via direct model:`, denormalizedData);
            return denormalizedData;
        }
        
        console.warn(`[CLASS_FETCH] Class ${classId} not found in any method`);
        return null;
        
    } catch (err) {
        console.error(`[CLASS_FETCH] ❌ Unexpected error:`, err.message);
        return null;
    }
};

// GET /api/students
const listStudents = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, classId } = req.query;
    const userContext = req.userContext || req.user;
    
    if (!userContext) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }
    
    try {
        // Build filters for repository
        const filters = classId ? { classId } : {};
        const options = { page: Number(page), limit: Number(limit) };
        
        // Debug logging
        console.log('[DEBUG] listStudents called with:', { userContext: { userId: userContext.userId, tenantId: userContext.tenantId, role: userContext.role }, filters, options });
        
        // RLS enforcement: Use repository to get only accessible students
        const { count, rows } = await repos.student.findVisibleStudents(userContext, filters, options);
        console.log('[DEBUG] findVisibleStudents returned:', { count, rowsCount: rows.length });
        
        // Convert S3 keys to proxy URLs (backend serves images)
        const dataWithProxyUrls = rows.map((student) => {
            const s = student.toJSON ? student.toJSON() : student;
            if (s.photoKey) {
                s.photoUrl = buildProxyUrl(s.photoKey);
            } else {
                s.photoUrl = null;
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
        console.error('Error listing students:', err);
        if (err.sql) console.error('SQL Error:', err.sql);
        if (err.stack) console.error('Stack:', err.stack);
        return sendError(res, err, 'Failed to list students');
    }
});

// POST /api/students/onboarding - Start a new onboarding record (partial student)
const startOnboarding = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    
    if (!userContext || !userContext.tenantId) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }

    const { onboardingData, step } = req.body || {};
    const payload = {
        onboardingData: onboardingData || {},
        onboardingStep: step || 1,
        onboardingCompleted: false,
        status: 'active'
    };

    // RLS enforcement: Repository enforces tenant isolation
    const student = await repos.student.createStudent(payload, userContext);
    const s = student.toJSON ? student.toJSON() : student;
    res.status(201).json({ success: true, data: s });
});

// PATCH /api/students/:id/onboarding - Update onboarding step/data for an existing student
const updateOnboarding = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    const id = req.params.id;
    
    if (!userContext || !userContext.tenantId) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }

    const { onboardingData, step, completed } = req.body || {};
    
    // RLS enforcement: Repository enforces access control
    const student = await repos.student.findStudentById(id, userContext);
    if (!student) {
        return sendError(res, { status: 404, body: { success: false, error: 'Student not found', code: 'NOT_FOUND' } });
    }

    const updates = {};
    if (onboardingData !== undefined) {
        updates.onboardingData = Object.assign({}, student.onboardingData || {}, onboardingData);
    }
    if (step !== undefined) updates.onboardingStep = step;
    if (completed !== undefined) updates.onboardingCompleted = Boolean(completed);

    // RLS enforcement: Repository validates access
    await repos.student.updateStudent(id, updates, userContext);
    const updated = await repos.student.findStudentById(id, userContext);
    
    const s = updated.toJSON ? updated.toJSON() : updated;
    res.json({ success: true, data: s });
});

// POST /api/students
const createStudent = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    
    if (!userContext || !userContext.tenantId) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }
    
    if (!req.body.admissionNo) {
        return sendError(res, { status: 400, body: { success: false, error: 'admissionNo is required', code: 'ADMISSION_NO_REQUIRED' } });
    }
    
    // Fetch and denormalize class data if classId provided
    let classData = null;
    if (req.body.classId) {
        classData = await getClassDataForStudent(req.body.classId, userContext);
    }
    // Build admissionClass from provided className or denormalized classData
    let admissionClass = null;
    const providedClassName = req.body.className || (classData && (classData.className || classData.name));
    const sectionForAdmission = req.body.section || (classData && classData.section);
    if (providedClassName) {
        admissionClass = sectionForAdmission ? `${providedClassName} - ${sectionForAdmission}` : providedClassName;
    }
    
    // Note: File will be uploaded AFTER student creation (so we have the student.id for key generation)

    const payload = {
        // Basic Info
        admissionNo: req.body.admissionNo,
        firstName: req.body.firstName,
        lastName: req.body.lastName || '',
        dateOfBirth: req.body.dateOfBirth || null,
        classId: req.body.classId || null,
        classData: classData, // Store denormalized class data
        photoKey: null,  // Will be set after file upload
        
        // Academic Info
        stream: req.body.stream || null,
        session: req.body.session || null,
        admissionClass: admissionClass,
        
        // Personal Details
        gender: req.body.gender || null,
        category: req.body.category || null,
        religion: req.body.religion || null,
        motherTongue: req.body.motherTongue || null,
        
        // Contact Info
        studentMobile: req.body.studentMobile || null,
        studentEmail: req.body.studentEmail || null,
        
        // Current Address
        currentAddressLine1: req.body.currentAddressLine1 || null,
        currentCity: req.body.currentCity || null,
        currentState: req.body.currentState || null,
        currentPIN: req.body.currentPIN || null,
        
        // Permanent Address
        permanentAddressLine1: req.body.permanentAddressLine1 || null,
        permanentCity: req.body.permanentCity || null,
        permanentState: req.body.permanentState || null,
        permanentPIN: req.body.permanentPIN || null,
        
        // Family Details
        fatherName: req.body.fatherName || null,
        fatherPhone: req.body.fatherPhone || null,
        fatherEmail: req.body.fatherEmail || null,
        fatherOccupation: req.body.fatherOccupation || null,
        motherName: req.body.motherName || null,
        motherPhone: req.body.motherPhone || null,
        motherEmail: req.body.motherEmail || null,
        motherOccupation: req.body.motherOccupation || null,
        
        // Guardian Details
        guardianName: req.body.guardianName || null,
        guardianPhone: req.body.guardianPhone || null,
        guardianRelation: req.body.guardianRelation || null,
        
        status: req.body.status || 'active'
    };

    // RLS enforcement: Repository enforces tenant isolation automatically
    const student = await repos.student.createStudent(payload, userContext);
    
    // After creation, if we have a file buffer, upload it to S3 using the real student ID
    if (req.file && req.file.buffer) {
        if (!validateExtensionForCategory(req.file.originalname, 'profile')) {
            return sendError(res, { status: 400, body: { success: false, error: 'Invalid photo type', code: 'VALIDATION_ERROR' } });
        }
        const photoKey = generateS3Key(userContext.tenantId, 'students', student.id, 'profile', req.file.originalname);
        try {
            await uploadBufferToS3(s3Client, S3_BUCKET, photoKey, req.file.buffer, req.file.mimetype);
            await repos.student.updateStudent(student.id, { photoKey }, userContext);
            logger.info(`[createStudent] Uploaded photo to S3: ${photoKey}`);
        } catch (err) {
            logger.error(`[createStudent] Photo upload failed: ${err.message}`);
            return sendError(res, { status: 500, body: { success: false, error: 'Photo upload failed', code: 'S3_ERROR' } });
        }
    }
    
    // Fetch updated student
    const updated = await repos.student.findStudentById(student.id, userContext);
    const s = updated.toJSON ? updated.toJSON() : updated;
    if (s.photoKey) {
        s.photoUrl = buildProxyUrl(s.photoKey);
    } else {
        s.photoUrl = null;
    }
    res.status(201).json({ success: true, data: s });
});

// PUT /api/students/:id
const updateStudent = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    const studentId = req.params.id;
    
    if (!userContext || !userContext.tenantId) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }
    
    // If classId is being changed, fetch new class data
    let classData = undefined;
    if (req.body.classId) {
        classData = await getClassDataForStudent(req.body.classId, userContext);
    }
    // If a className is provided in request, construct admissionClass (fallback to classData)
    let admissionClass = undefined;
    const providedClassName = req.body.className || (classData && (classData.className || classData.name));
    const sectionForAdmission = req.body.section || (classData && classData.section);
    if (providedClassName) {
        admissionClass = sectionForAdmission ? `${providedClassName} - ${sectionForAdmission}` : providedClassName;
    }
    
    // Handle multipart photo file if provided - upload to S3 first, then update
    let photoKeyForUpdate = undefined;
    if (req.file && req.file.buffer) {
        if (!validateExtensionForCategory(req.file.originalname, 'profile')) {
            return sendError(res, { status: 400, body: { success: false, error: 'Invalid photo type', code: 'VALIDATION_ERROR' } });
        }
        const newKey = generateS3Key(userContext.tenantId, 'students', studentId, 'profile', req.file.originalname);
        try {
            await uploadBufferToS3(s3Client, S3_BUCKET, newKey, req.file.buffer, req.file.mimetype);
            logger.info(`[updateStudent] Uploaded photo to S3: ${newKey}`);
            // Delete old photo if exists and matches tenant
            const existing = await repos.student.findStudentById(studentId, userContext);
            if (existing && existing.photoKey && existing.photoKey !== newKey && existing.photoKey.includes(`tenants/${userContext.tenantId}`)) {
                try {
                    await require('../utils/s3Helper').deleteS3Object(s3Client, S3_BUCKET, existing.photoKey, userContext.tenantId, { userId: userContext.userId, entityId: studentId, entityType: 'student', category: 'photo', action: 'DELETE_OLD_ON_UPDATE' });
                } catch (e) {
                    logger.warn(`[updateStudent] Failed to delete old photo: ${e.message}`);
                }
            }
            photoKeyForUpdate = newKey;
        } catch (err) {
            logger.error(`[updateStudent] Photo upload failed: ${err.message}`);
            return sendError(res, { status: 500, body: { success: false, error: 'Photo upload failed', code: 'S3_ERROR' } });
        }
    }

    const updates = {
        // Basic Info
        firstName: req.body.firstName || undefined,
        lastName: req.body.lastName || undefined,
        dateOfBirth: req.body.dateOfBirth || undefined,
        classId: req.body.classId || undefined,
        classData: classData, // Update denormalized class data if classId changed
        photoUrl: undefined,
        photoKey: photoKeyForUpdate,
        
        // Academic Info
        stream: req.body.stream || undefined,
        session: req.body.session || undefined,
        
        // Personal Details
        gender: req.body.gender || undefined,
        category: req.body.category || undefined,
        religion: req.body.religion || undefined,
        motherTongue: req.body.motherTongue || undefined,
        
        // Contact Info
        studentMobile: req.body.studentMobile || undefined,
        studentEmail: req.body.studentEmail || undefined,
        
        // Current Address
        currentAddressLine1: req.body.currentAddressLine1 || undefined,
        currentCity: req.body.currentCity || undefined,
        currentState: req.body.currentState || undefined,
        currentPIN: req.body.currentPIN || undefined,
        
        // Permanent Address
        permanentAddressLine1: req.body.permanentAddressLine1 || undefined,
        permanentCity: req.body.permanentCity || undefined,
        permanentState: req.body.permanentState || undefined,
        permanentPIN: req.body.permanentPIN || undefined,
        
        // Family Details
        fatherName: req.body.fatherName || undefined,
        fatherPhone: req.body.fatherPhone || undefined,
        fatherEmail: req.body.fatherEmail || undefined,
        fatherOccupation: req.body.fatherOccupation || undefined,
        motherName: req.body.motherName || undefined,
        motherPhone: req.body.motherPhone || undefined,
        motherEmail: req.body.motherEmail || undefined,
        motherOccupation: req.body.motherOccupation || undefined,
        
        // Guardian Details
        guardianName: req.body.guardianName || undefined,
        guardianPhone: req.body.guardianPhone || undefined,
        guardianRelation: req.body.guardianRelation || undefined,
        
        status: req.body.status || undefined,
        admissionClass: admissionClass
    };
    
    // Remove undefined fields
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    // RLS enforcement: Repository validates access and updates only if allowed
    try {
        await repos.student.updateStudent(studentId, updates, userContext);
        const student = await repos.student.findStudentById(studentId, userContext);
        
        if (!student) {
            return sendError(res, { status: 404, body: { success: false, error: 'Student not found', code: 'NOT_FOUND' } });
        }
        
        const s = student.toJSON ? student.toJSON() : student;
        if (s.photoKey) {
            s.photoUrl = buildProxyUrl(s.photoKey);
        } else {
            s.photoUrl = null;
        }
        res.json({ success: true, data: s });
    } catch (err) {
        if (err.message.includes('INSUFFICIENT_PERMISSIONS')) {
            return sendError(res, { status: 403, body: { success: false, error: err.message, code: 'INSUFFICIENT_PERMISSIONS' } });
        }
        return sendError(res, err, 'Failed to update student');
    }
});

// GET /api/students/:id
const getStudentById = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    const studentId = req.params.id;
    
    if (!userContext || !userContext.tenantId) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }
    
    // RLS enforcement: Repository returns null if user doesn't have access
    const student = await repos.student.findStudentById(studentId, userContext);
    
    if (!student) {
        return sendError(res, { status: 404, body: { success: false, error: 'Student not found', code: 'NOT_FOUND' } });
    }
    
    const s = student.toJSON ? student.toJSON() : student;
    if (s.photoKey) {
        s.photoUrl = buildProxyUrl(s.photoKey);
    } else {
        s.photoUrl = null;
    }
    res.json({ success: true, data: s });
});

// DELETE /api/students/:id
const deleteStudent = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    const studentId = req.params.id;
    
    if (!userContext || !userContext.tenantId) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }
    
    // RLS enforcement: Repository validates deletion permissions
    try {
        await repos.student.deleteStudent(studentId, userContext);
        res.status(204).send();
    } catch (err) {
        if (err.message.includes('INSUFFICIENT_PERMISSIONS')) {
            return sendError(res, { status: 403, body: { success: false, error: err.message, code: 'INSUFFICIENT_PERMISSIONS' } });
        }
        return sendError(res, err, 'Failed to delete student');
    }
});

module.exports = {
    listStudents,
    createStudent,
    updateStudent,
    getStudentById,
    deleteStudent,
    startOnboarding,
    updateOnboarding
};