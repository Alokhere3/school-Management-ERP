const asyncHandler = require('../utils/asyncHandler');
const studentService = require('../services/studentService');
const { buildProxyUrl, generateS3Key, validateExtensionForCategory } = require('../utils/s3Helper');
const { sendError } = require('../utils/errorMapper');
const { RepositoryFactory } = require('../repositories');
const { s3Client, bucket: S3_BUCKET, uploadBufferToS3 } = require('../config/s3');
const { sequelize } = require('../config/database');
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
        // Fetching class ${classId} for student
        let classRecord = null;
        const opts = { ...userContext }; // Clone context

        // 1. Try fetching by ID using repository (RLS-aware)
        try {
            // Check if classId looks like a UUID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId);

            if (isUUID) {
                classRecord = await repos.class.findClassById(classId, userContext);
            } else {
                // Not a UUID, try finding by className (e.g. 'II')
                // Note: This is a hacky fallback, assuming className is unique per tenant
                const Class = require('../models/Class');
                classRecord = await Class.findOne({
                    where: {
                        className: classId,
                        tenantId: userContext.tenantId
                    }
                });
            }

            if (classRecord) {
                const classData = classRecord.toJSON ? classRecord.toJSON() : classRecord;
                const denormalizedData = {
                    id: classData.id,
                    name: classData.className, // Map className to name
                    section: classData.section,
                    academicYear: classData.academicYear, // If exists
                    classTeacherId: classData.classTeacherId // If exists
                };
                logger.debug(`[CLASS_FETCH] Fetched via repository/model for input: ${classId}`);
                return denormalizedData;
            }
        } catch (repoErr) {
            logger.warn(`[CLASS_FETCH] Repository/Model fetch failed: ${repoErr.message}`);
        }

        logger.warn(`[CLASS_FETCH] Class ${classId} not found in any method`);
        return null;

    } catch (err) {
        logger.error(`[CLASS_FETCH] Unexpected error: ${err.message}`);
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
        // logger.debug('listStudents called with options', { filters, options });

        // RLS enforcement: Use repository to get only accessible students
        const { count, rows } = await repos.student.findVisibleStudents(userContext, filters, options);
        // Debug logging for row count
        // logger.debug('findVisibleStudents result', { count, rowsCount: rows.length });

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

    // Fetch and denormalize class data if classId provided
    let classData = null;
    if (req.body.classId) {
        classData = await getClassDataForStudent(req.body.classId, userContext);
    }

    // Note: File will be uploaded AFTER student creation (so we have the student.id for key generation)

    const payload = {
        // Basic Info
        admissionNo: null, // Always auto-generate admissionNo in repository
        firstName: req.body.firstName,
        lastName: req.body.lastName || '',
        dateOfBirth: req.body.dateOfBirth || null,
        classId: classData ? classData.id : (req.body.classId || null), // Use resolved ID if available
        classData: classData, // Store denormalized class data
        photoKey: null,  // Will be set after file upload

        // Academic Info
        stream: req.body.stream || null,
        session: req.body.session || null,
        admissionClass: req.body.className || null,

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

    // Extract sibling IDs for later processing
    const siblingIds = req.body.siblingIds || [];

    // Start transaction for atomic student + sibling creation
    const transaction = await sequelize.transaction();

    try {
        // RLS enforcement: Repository enforces tenant isolation automatically
        // Pass transaction to student creation
        const student = await repos.student.createStudent(payload, userContext, transaction);

        // After creation, if we have a file buffer, upload it to S3 using the real student ID
        if (req.file && req.file.buffer) {
            if (!validateExtensionForCategory(req.file.originalname, 'profile')) {
                await transaction.rollback();
                return sendError(res, { status: 400, body: { success: false, error: 'Invalid photo type', code: 'VALIDATION_ERROR' } });
            }
            const photoKey = generateS3Key(userContext.tenantId, 'students', student.id, 'profile', req.file.originalname);
            try {
                await uploadBufferToS3(s3Client, S3_BUCKET, photoKey, req.file.buffer, req.file.mimetype);
                // Update with transaction
                await repos.student.updateStudent(student.id, { photoKey }, userContext, transaction);
                logger.info(`[createStudent] Uploaded photo to S3: ${photoKey}`);
            } catch (err) {
                await transaction.rollback();
                logger.error(`[createStudent] Photo upload failed: ${err.message}`);
                return sendError(res, { status: 500, body: { success: false, error: 'Photo upload failed', code: 'S3_ERROR' } });
            }
        }

        // Create sibling relationships if provided
        if (siblingIds && siblingIds.length > 0) {
            try {
                const siblingResult = await repos.studentSibling.createSiblingRelationships(student.id, siblingIds, userContext, transaction);
                logger.info(`[createStudent] Created ${siblingIds.length} sibling relationships for student ${student.id}`);
            } catch (siblingErr) {
                logger.error(`[createStudent] Sibling creation error: ${siblingErr.message}`);
                await transaction.rollback();
                logger.error(`[createStudent] Sibling creation failed: ${siblingErr.message}`);
                return sendError(res, { status: 400, body: { success: false, error: siblingErr.message, code: 'SIBLING_ERROR' } });
            }
        }

        // Commit transaction
        await transaction.commit();

        // Fetch updated student with siblings
        const updated = await repos.student.findStudentWithSiblings(student.id, userContext);
        const s = updated.toJSON ? updated.toJSON() : updated;
        if (s.photoKey) {
            s.photoUrl = buildProxyUrl(s.photoKey);
        } else {
            s.photoUrl = null;
        }
        res.status(201).json({ success: true, data: s });
    } catch (err) {
        logger.error(`[createStudent] Transaction failed: ${err.message}`);
        await transaction.rollback();
        console.error('Error creating student:', err);
        if (err.sql) console.error('SQL Error:', err.sql);
        if (err.stack) console.error('Stack:', err.stack);
        return sendError(res, err, 'Failed to create student');
    }
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

    // Extract sibling IDs for update (if provided)
    const siblingIds = req.body.siblingIds;

    const updates = {
        // Basic Info
        firstName: req.body.firstName || undefined,
        lastName: req.body.lastName || undefined,
        dateOfBirth: req.body.dateOfBirth || undefined,
        classId: classData ? classData.id : (req.body.classId || undefined), // Use resolved ID if available
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
        admissionClass: req.body.className || undefined
    };

    // Remove undefined fields
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    // Start transaction for atomic student + sibling update
    const transaction = await sequelize.transaction();

    try {
        // RLS enforcement: Repository validates access and updates only if allowed
        // Pass transaction to student update
        await repos.student.updateStudent(studentId, updates, userContext, transaction);

        // Handle sibling relationship updates if provided
        if (siblingIds !== undefined) {
            try {
                // Remove all existing sibling relationships for this student
                await repos.studentSibling.removeSiblingsForStudent(studentId, userContext, transaction);

                // Create new sibling relationships if provided
                if (siblingIds && siblingIds.length > 0) {
                    await repos.studentSibling.createSiblingRelationships(studentId, siblingIds, userContext, transaction);
                    logger.info(`[updateStudent] Updated ${siblingIds.length} sibling relationships for student ${studentId}`);
                }
            } catch (siblingErr) {
                await transaction.rollback();
                logger.error(`[updateStudent] Sibling update failed: ${siblingErr.message}`);
                return sendError(res, { status: 400, body: { success: false, error: siblingErr.message, code: 'SIBLING_ERROR' } });
            }
        }

        // Commit transaction
        await transaction.commit();

        const student = await repos.student.findStudentWithSiblings(studentId, userContext);

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
        await transaction.rollback();
        if (err.message.includes('INSUFFICIENT_PERMISSIONS')) {
            return sendError(res, { status: 403, body: { success: false, error: err.message, code: 'INSUFFICIENT_PERMISSIONS' } });
        }
        return sendError(res, err, 'Failed to update student');
    }
});

// GET /api/students/class/:classId
const getStudentsByClass = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const classId = req.params.classId;
    const userContext = req.userContext || req.user;

    if (!userContext) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }

    if (!classId) {
        return sendError(res, { status: 400, body: { success: false, error: 'classId is required', code: 'CLASS_ID_REQUIRED' } });
    }

    try {
        // RLS enforcement: Repository returns only accessible students
        const options = { page: Number(page), limit: Number(limit) };
        const { count, rows } = await repos.student.findStudentsByClass(classId, userContext, options);

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
                current: Number(page),
                classId: classId
            }
        });
    } catch (err) {
        console.error('Error fetching students by class:', err);
        if (err.sql) console.error('SQL Error:', err.sql);
        return sendError(res, err, 'Failed to fetch students by class');
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
    // Uses single query with join to fetch student + siblings
    const student = await repos.student.findStudentWithSiblings(studentId, userContext);

    if (!student) {
        return sendError(res, { status: 404, body: { success: false, error: 'Student not found', code: 'NOT_FOUND' } });
    }

    const s = student.toJSON ? student.toJSON() : student;
    if (s.photoKey) {
        s.photoUrl = buildProxyUrl(s.photoKey);
    } else {
        s.photoUrl = null;
    }

    // Convert sibling photoKeys to photoUrls
    if (s.siblings && Array.isArray(s.siblings)) {
        s.siblings = s.siblings.map(sibling => {
            if (sibling.photoKey) {
                sibling.photoUrl = buildProxyUrl(sibling.photoKey);
            } else {
                sibling.photoUrl = null;
            }
            return sibling;
        });
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

    // Start transaction for atomic student + sibling deletion
    const transaction = await sequelize.transaction();

    try {
        // RLS enforcement: Repository validates deletion permissions and handles sibling cleanup
        // Remove all sibling relationships with transaction
        await repos.studentSibling.removeSiblingsForStudent(studentId, userContext, transaction);

        // Delete the student with transaction
        await repos.student.deleteStudent(studentId, userContext, transaction);

        // Commit transaction
        await transaction.commit();
        res.status(204).send();
    } catch (err) {
        await transaction.rollback();
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
    getStudentsByClass,
    deleteStudent,
    startOnboarding,
    updateOnboarding
};