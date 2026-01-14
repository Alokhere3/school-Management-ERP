const asyncHandler = require('../utils/asyncHandler');
const { sendError } = require('../utils/errorMapper');
const { RepositoryFactory } = require('../repositories');
const { extractKeyFromUrl, buildProxyUrl } = require('../utils/s3Helper');
const s3Helper = require('../utils/s3Helper');
const { s3Client, bucket: S3_BUCKET, uploadBufferToS3 } = require('../config/s3');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

// Initialize repository factory
const repos = new RepositoryFactory();

/**
 * Convert S3 keys to presigned URLs for response
 * Files are served via proxy URLs
 * 
 * @param {Object} teacher - Teacher record
 * @returns {Object} Teacher with URLs instead of keys
 */
const convertKeysToUrls = async (teacher) => {
    const data = teacher.toJSON ? teacher.toJSON() : teacher;

    // Convert S3 keys to proxy URLs
    // Pass the full key (e.g., "tenants/uuid/students/filename.jpg") to buildProxyUrl
    // The /images route handles the full path and fetches from S3
    if (data.profileImageKey) {
        try {
            data.profileImageUrl = buildProxyUrl(data.profileImageKey);
        } catch (err) {
            logger.warn(`[convertKeysToUrls] Could not generate profileImageUrl: ${err.message}`);
        }
    }

    if (data.resumeKey) {
        try {
            data.resumeUrl = buildProxyUrl(data.resumeKey);
        } catch (err) {
            logger.warn(`[convertKeysToUrls] Could not generate resumeUrl: ${err.message}`);
        }
    }

    if (data.joiningLetterKey) {
        try {
            data.joiningLetterUrl = buildProxyUrl(data.joiningLetterKey);
        } catch (err) {
            logger.warn(`[convertKeysToUrls] Could not generate joiningLetterUrl: ${err.message}`);
        }
    }
    
    return data;
};

/**
 * POST /api/teachers
 * Create a new teacher with profile image, resume, and joining letter uploads
 * 
 * Accepts multipart/form-data with:
 * - Form fields: all teacher data (firstName, lastName, email, password, etc.)
 * - Files: profileImage, resume, joiningLetter (optional)
 * 
 * Flow:
 * 1. Validate inputs (email, phone, file types/sizes)
 * 2. Auto-generate teacherId if not provided (per tenant, starting from 1)
 * 3. Start transaction
 * 4. Upload files to S3 (multer middleware handles this)
 * 5. Create User + Teacher in DB
 * 6. Link S3 keys to Teacher record
 * 7. Commit transaction or rollback on error
 * 
 * @param {String} firstName - Required
 * @param {String} lastName - Required
 * @param {String} email - Required, unique per tenant
 * @param {String} password - Required, min 8 chars
 * @param {String} phone - Optional
 * @param {String} teacherId - Optional, auto-generated per tenant if not provided (starts from 1, increments)
 * @param {String} dateOfJoining - Optional, YYYY-MM-DD format
 * @param {String} contractType - Optional: Permanent|Temporary|Contract|Probation
 * @param {String} qualifications - Optional
 * @param {String} classIds - Optional, JSON array of class UUIDs
 * @param {String} subjectIds - Optional, JSON array of subject UUIDs
 * @param {File} profileImage - Optional, JPG/PNG/SVG, max 4MB
 * @param {File} resume - Optional, PDF, max 4MB
 * @param {File} joiningLetter - Optional, PDF, max 4MB
 * 
 * @returns {201} { success: true, teacher: {...}, message: "Teacher created successfully" }
 * @returns {400} Validation error (missing fields, invalid format, file size)
 * @returns {409} Duplicate email
 * @returns {500} Server error or S3 upload failure
 */
const createTeacher = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;

    if (!userContext) {
        return sendError(res, {
            status: 401,
            body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' }
        });
    }

    // DEBUG: Log what we received
    logger.info(`[createTeacher] req.body keys: ${JSON.stringify(Object.keys(req.body))}`);
    logger.info(`[createTeacher] req.body: ${JSON.stringify(req.body)}`);
    logger.info(`[createTeacher] req.files: ${JSON.stringify(req.files ? Object.keys(req.files) : 'none')}`);

    const transaction = await sequelize.transaction();

    try {
        // Extract request data
        const {
            firstName,
            lastName,
            email,
            phone,
            password,
            teacherId,
            gender,
            dateOfBirth,
            bloodGroup,
            maritalStatus,
            languageKnown,
            qualification,
            workExperience,
            fatherName,
            motherName,
            address,
            permanentAddress,
            panNumber,
            notes,
            primaryContactNumber,
            emailAddress,
            dateOfJoining,
            dateOfLeaving,
            contractType,
            workShift,
            workLocation,
            previousSchool,
            previousSchoolAddress,
            previousSchoolPhone,
            classIds: classIdsStr,
            subjectIds: subjectIdsStr,
            epfNo,
            basicSalary,
            medicalLeaves,
            casualLeaves,
            maternityLeaves,
            sickLeaves,
            accountName,
            accountNumber,
            bankName,
            ifscCode,
            branchName,
            routeId,
            vehicleNumber,
            pickupPoint,
            hostelId,
            roomNo,
            facebookUrl,
            instagramUrl,
            linkedinUrl,
            youtubeUrl,
            twitterUrl,
            status
        } = req.body;

        // === VALIDATION ===
        if (!firstName || !lastName) {
            await transaction.rollback();
            return sendError(res, {
                status: 400,
                body: { success: false, error: 'firstName and lastName are required', code: 'VALIDATION_ERROR' }
            });
        }

        if (!email) {
            await transaction.rollback();
            return sendError(res, {
                status: 400,
                body: { success: false, error: 'email is required', code: 'VALIDATION_ERROR' }
            });
        }

        if (!password || password.length < 8) {
            await transaction.rollback();
            return sendError(res, {
                status: 400,
                body: { success: false, error: 'password is required and must be at least 8 characters', code: 'VALIDATION_ERROR' }
            });
        }

        // teacherId is optional - will be auto-generated by repository if not provided
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            await transaction.rollback();
            return sendError(res, {
                status: 400,
                body: { success: false, error: 'Invalid email format', code: 'VALIDATION_ERROR' }
            });
        }

        // Parse JSON arrays
        let classIds = [];
        let subjectIds = [];
        try {
            if (classIdsStr) {
                classIds = typeof classIdsStr === 'string' ? JSON.parse(classIdsStr) : classIdsStr;
            }
            if (subjectIdsStr) {
                subjectIds = typeof subjectIdsStr === 'string' ? JSON.parse(subjectIdsStr) : subjectIdsStr;
            }
        } catch (err) {
            await transaction.rollback();
            return sendError(res, {
                status: 400,
                body: { success: false, error: 'Invalid JSON in classIds or subjectIds', code: 'VALIDATION_ERROR' }
            });
        }

        // === HANDLE FILE UPLOADS ===
        // We'll create teacher first (so we have an entityId), then upload any multipart files (memory buffer)
        const multipartFiles = req.files || {};
        const fileKeys = {};

        // === CREATE TEACHER + USER ===
        const teacherData = {
            email,  // CRITICAL: Must include email for user creation
            phone,  // CRITICAL: Must include phone for user creation
            teacherId,
            firstName,
            lastName,
            gender: gender || null,
            dateOfBirth: dateOfBirth || null,
            bloodGroup: bloodGroup || null,
            maritalStatus: maritalStatus || null,
            languageKnown: languageKnown ? (typeof languageKnown === 'string' ? JSON.parse(languageKnown) : languageKnown) : [],
            qualification: qualification || null,
            workExperience: workExperience || null,
            fatherName: fatherName || null,
            motherName: motherName || null,
            address: address || null,
            permanentAddress: permanentAddress || null,
            panNumber: panNumber || null,
            notes: notes || null,
            primaryContactNumber: primaryContactNumber || phone || null,
            emailAddress: emailAddress || email,
            dateOfJoining: dateOfJoining || null,
            dateOfLeaving: dateOfLeaving || null,
            contractType: contractType || null,
            workShift: workShift || null,
            workLocation: workLocation || null,
            previousSchool: previousSchool || null,
            previousSchoolAddress: previousSchoolAddress || null,
            previousSchoolPhone: previousSchoolPhone || null,
            classIds: classIds,
            subjectIds: subjectIds,
            epfNo: epfNo || null,
            basicSalary: basicSalary ? parseFloat(basicSalary) : null,
            medicalLeaves: medicalLeaves ? parseInt(medicalLeaves) : 0,
            casualLeaves: casualLeaves ? parseInt(casualLeaves) : 0,
            maternityLeaves: maternityLeaves ? parseInt(maternityLeaves) : 0,
            sickLeaves: sickLeaves ? parseInt(sickLeaves) : 0,
            accountName: accountName || null,
            accountNumber: accountNumber || null,
            bankName: bankName || null,
            ifscCode: ifscCode || null,
            branchName: branchName || null,
            routeId: routeId || null,
            vehicleNumber: vehicleNumber || null,
            pickupPoint: pickupPoint || null,
            hostelId: hostelId || null,
            roomNo: roomNo || null,
            facebookUrl: facebookUrl || null,
            instagramUrl: instagramUrl || null,
            linkedinUrl: linkedinUrl || null,
            youtubeUrl: youtubeUrl || null,
            twitterUrl: twitterUrl || null,
            status: status || 'active',
            ...fileKeys
        };

        // Create teacher + user first (without file keys) so we have the teacher.id for key generation
        const teacherDataNoFiles = { ...teacherData };
        delete teacherDataNoFiles.profileImageKey;
        delete teacherDataNoFiles.resumeKey;
        delete teacherDataNoFiles.joiningLetterKey;

        const teacher = await repos.teacher.createTeacher(teacherDataNoFiles, password, userContext, transaction);

        // If multipart files provided (memory), upload them to S3 now and persist keys within the same transaction
        try {
            if (multipartFiles && Object.keys(multipartFiles).length > 0) {
                const uploads = {};
                // profileImage
                if (multipartFiles.profileImage && multipartFiles.profileImage[0] && multipartFiles.profileImage[0].buffer) {
                    const file = multipartFiles.profileImage[0];
                    if (!s3Helper.validateExtensionForCategory(file.originalname, 'profile')) {
                        throw Object.assign(new Error('Invalid profile image type'), { code: 'VALIDATION_ERROR' });
                    }
                    const key = s3Helper.generateS3Key(userContext.tenantId, 'teachers', teacher.id, 'profile', file.originalname);
                    await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
                    uploads.profileImageKey = key;
                    logger.info(`[createTeacher] Uploaded profile image to S3: ${key}`);
                }

                // resume
                if (multipartFiles.resume && multipartFiles.resume[0] && multipartFiles.resume[0].buffer) {
                    const file = multipartFiles.resume[0];
                    if (!s3Helper.validateExtensionForCategory(file.originalname, 'resume')) {
                        throw Object.assign(new Error('Invalid resume type'), { code: 'VALIDATION_ERROR' });
                    }
                    const key = s3Helper.generateS3Key(userContext.tenantId, 'teachers', teacher.id, 'resume', file.originalname);
                    await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
                    uploads.resumeKey = key;
                    logger.info(`[createTeacher] Uploaded resume to S3: ${key}`);
                }

                // joiningLetter
                if (multipartFiles.joiningLetter && multipartFiles.joiningLetter[0] && multipartFiles.joiningLetter[0].buffer) {
                    const file = multipartFiles.joiningLetter[0];
                    if (!s3Helper.validateExtensionForCategory(file.originalname, 'joining_letter')) {
                        throw Object.assign(new Error('Invalid joining letter type'), { code: 'VALIDATION_ERROR' });
                    }
                    const key = s3Helper.generateS3Key(userContext.tenantId, 'teachers', teacher.id, 'joining_letter', file.originalname);
                    await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
                    uploads.joiningLetterKey = key;
                    logger.info(`[createTeacher] Uploaded joining letter to S3: ${key}`);
                }

                if (Object.keys(uploads).length > 0) {
                    await repos.teacher.updateFileKeys(teacher.id, uploads, userContext, transaction);
                }
            }
        } catch (err) {
            logger.error(`[createTeacher] File upload error: ${err.message}`);
            throw err;
        }

        // Commit transaction
        await transaction.commit();

        logger.info(`[createTeacher] ✅ Teacher created: ${teacher.id}`);

        return res.status(201).json({
            success: true,
            message: 'Teacher created successfully',
            teacher: await convertKeysToUrls(teacher)
        });

    } catch (error) {
        // Rollback transaction on any error
        await transaction.rollback();

        logger.error(`[createTeacher] ❌ Error: ${error.message}`);

        // Handle specific error codes
        if (error.code === 'DUPLICATE_EMAIL') {
            return sendError(res, {
                status: 409,
                body: { success: false, error: error.message, code: 'DUPLICATE_EMAIL' }
            });
        }

        if (error.code === 'VALIDATION_ERROR') {
            return sendError(res, {
                status: error.status || 400,
                body: { success: false, error: error.message, code: 'VALIDATION_ERROR' }
            });
        }

        if (error.code === 'FORBIDDEN') {
            return sendError(res, {
                status: 403,
                body: { success: false, error: error.message, code: 'FORBIDDEN' }
            });
        }

        return sendError(res, {
            status: error.status || 500,
            body: { success: false, error: error.message || 'Failed to create teacher' }
        });
    }
});

/**
 * GET /api/teachers
 * List all teachers visible to the user with RLS enforcement
 * 
 * Query parameters:
 * @param {Number} page - Page number (default: 1)
 * @param {Number} limit - Records per page (default: 20)
 * @param {String} status - Filter by status (active|inactive|on-leave|suspended|resigned)
 * @param {String} contractType - Filter by contract type
 * @param {String} search - Search by firstName, lastName, email, teacherId
 * 
 * @returns {200} { success: true, data: { count, rows, page, limit, totalPages } }
 * @returns {401} Authentication required
 * @returns {500} Server error
 */
const listTeachers = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;

    if (!userContext) {
        return sendError(res, {
            status: 401,
            body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' }
        });
    }

    const { page = 1, limit = 20, status, contractType, search } = req.query;

    try {
        // Build filters
        const filters = {};
        if (status) filters.status = status;
        if (contractType) filters.contractType = contractType;

        const options = {
            page: Math.max(1, parseInt(page)),
            limit: Math.min(100, Math.max(1, parseInt(limit)))
        };

        let result;
        if (search) {
            result = await repos.teacher.search(search, userContext, options);
        } else {
            result = await repos.teacher.findVisibleTeachers(userContext, filters, options);
        }

        const { count, rows } = result;
        const totalPages = Math.ceil(count / options.limit);

        return res.status(200).json({
            success: true,
            data: {
                count,
                rows: await Promise.all(rows.map(t => convertKeysToUrls(t))),
                page: options.page,
                limit: options.limit,
                totalPages
            }
        });

    } catch (error) {
        logger.error(`[listTeachers] ❌ Error: ${error.message}`);

        return sendError(res, {
            status: error.status || 500,
            body: { success: false, error: error.message || 'Failed to list teachers' }
        });
    }
});

/**
 * GET /api/teachers/:id
 * Fetch a single teacher by ID with RLS enforcement
 * Returns presigned URLs for file access
 * 
 * @param {String} id - Teacher ID (UUID)
 * 
 * @returns {200} { success: true, teacher: {...} }
 * @returns {401} Authentication required
 * @returns {403} Forbidden (RLS denied access)
 * @returns {404} Teacher not found
 * @returns {500} Server error
 */
const getTeacherById = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;

    if (!userContext) {
        return sendError(res, {
            status: 401,
            body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' }
        });
    }

    const { id } = req.params;

    try {
        logger.info(`[getTeacherById] Fetching teacher ID: ${id}, userContext: ${JSON.stringify(userContext)}`);
        const teacher = await repos.teacher.findTeacherById(id, userContext);

        logger.info(`[getTeacherById] Retrieved teacher: ${teacher ? JSON.stringify(teacher.toJSON ? teacher.toJSON() : teacher) : 'null'}`);

        if (!teacher) {
            logger.warn(`[getTeacherById] Teacher not found for ID: ${id}`);
            return sendError(res, {
                status: 404,
                body: { success: false, error: 'Teacher not found', code: 'NOT_FOUND' }
            });
        }

        const convertedTeacher = await convertKeysToUrls(teacher);
        logger.info(`[getTeacherById] Converted teacher data: ${JSON.stringify(convertedTeacher)}`);

        return res.status(200).json({
            success: true,
            teacher: convertedTeacher
        });

    } catch (error) {
        logger.error(`[getTeacherById] ❌ Error: ${error.message}`);

        if (error.code === 'FORBIDDEN') {
            return sendError(res, {
                status: 403,
                body: { success: false, error: 'Forbidden', code: 'FORBIDDEN' }
            });
        }

        return sendError(res, {
            status: error.status || 500,
            body: { success: false, error: error.message || 'Failed to fetch teacher' }
        });
    }
});

/**
 * POST /api/teachers/:id/presign
 * Generate presigned PUT URL for teacher file upload (profile/resume/joiningLetter/documents)
 */
const presignTeacherUpload = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    if (!userContext) {
        return sendError(res, { status: 401, body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' } });
    }

    const { id } = req.params; // teacher id
    const { category, filename, contentType } = req.body || {};

    if (!category || !filename) {
        return sendError(res, { status: 400, body: { success: false, error: 'category and filename are required', code: 'VALIDATION_ERROR' } });
    }

    // Validate category
    const allowedCategories = ['profile', 'resume', 'joining_letter', 'documents'];
    if (!allowedCategories.includes(category)) {
        return sendError(res, { status: 400, body: { success: false, error: 'Invalid category', code: 'VALIDATION_ERROR' } });
    }

    // Ensure S3 client available
    if (!s3Client || !S3_BUCKET) {
        return sendError(res, { status: 500, body: { success: false, error: 'S3 not configured', code: 'S3_NOT_CONFIGURED' } });
    }

    // Check teacher exists and RLS
    const teacher = await repos.teacher.findTeacherById(id, userContext);
    if (!teacher) {
        return sendError(res, { status: 404, body: { success: false, error: 'Teacher not found', code: 'NOT_FOUND' } });
    }

    // Validate filename extension and content type
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'svg', 'avif'];
    const pdfExts = ['pdf'];

    if (category === 'profile' && !imageExts.includes(ext)) {
        return sendError(res, { status: 400, body: { success: false, error: 'Invalid image type', code: 'VALIDATION_ERROR' } });
    }
    if ((category === 'resume' || category === 'joining_letter') && !pdfExts.includes(ext)) {
        return sendError(res, { status: 400, body: { success: false, error: 'Resume/joining letter must be PDF', code: 'VALIDATION_ERROR' } });
    }

    // Generate key and presigned URL
    try {
        const key = s3Helper.generateS3Key(userContext.tenantId, 'teachers', id, category, filename);
        const maxSize = 4 * 1024 * 1024; // 4MB
        const ct = contentType || (imageExts.includes(ext) ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/pdf');
        const uploadUrl = await s3Helper.generatePresignedPutUrl(s3Client, S3_BUCKET, key, ct, 3600);

        return res.status(200).json({ success: true, key, uploadUrl, expiresIn: 3600, maxSize });
    } catch (err) {
        logger.error(`[presignTeacherUpload] Error: ${err.message}`);
        return sendError(res, { status: 500, body: { success: false, error: 'Failed to generate presigned URL' } });
    }
});

/**
 * PUT /api/teachers/:id
 * Update teacher record with partial updates and file replacements
 * 
 * Accepts multipart/form-data with:
 * - Form fields: any updatable teacher fields
 * - Files: profileImage, resume, joiningLetter (optional, replaces existing)
 * 
 * @param {String} id - Teacher ID (UUID)
 * @param {Any} field - Any updatable field (partial update allowed)
 * @param {File} profileImage - Optional, replaces existing
 * @param {File} resume - Optional, replaces existing
 * @param {File} joiningLetter - Optional, replaces existing
 * 
 * @returns {200} { success: true, teacher: {...}, message: "Teacher updated successfully" }
 * @returns {400} Validation error
 * @returns {401} Authentication required
 * @returns {403} Forbidden (insufficient permissions)
 * @returns {404} Teacher not found
 * @returns {409} Duplicate email
 * @returns {500} Server error
 */
const updateTeacher = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;

    if (!userContext) {
        return sendError(res, {
            status: 401,
            body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' }
        });
    }

    const { id } = req.params;
    const transaction = await sequelize.transaction();

    try {
        // Extract updatable fields from request
        const updateData = { ...req.body };

        // Parse JSON arrays if provided
        if (updateData.classIds && typeof updateData.classIds === 'string') {
            try {
                updateData.classIds = JSON.parse(updateData.classIds);
            } catch (err) {
                await transaction.rollback();
                return sendError(res, {
                    status: 400,
                    body: { success: false, error: 'Invalid JSON in classIds', code: 'VALIDATION_ERROR' }
                });
            }
        }

        if (updateData.subjectIds && typeof updateData.subjectIds === 'string') {
            try {
                updateData.subjectIds = JSON.parse(updateData.subjectIds);
            } catch (err) {
                await transaction.rollback();
                return sendError(res, {
                    status: 400,
                    body: { success: false, error: 'Invalid JSON in subjectIds', code: 'VALIDATION_ERROR' }
                });
            }
        }

        // Handle file uploads or presigned-key associations
        // Client may either upload via multipart (memory buffer) or upload via presigned URL and send keys in body
        const fileKeys = {};
        // If multipart files present, upload buffers to S3 first and set keys
        if (req.files && Object.keys(req.files).length > 0) {
            const files = req.files;
            // profileImage
            if (files.profileImage && files.profileImage[0] && files.profileImage[0].buffer) {
                const file = files.profileImage[0];
                if (!s3Helper.validateExtensionForCategory(file.originalname, 'profile')) {
                    await transaction.rollback();
                    return sendError(res, { status: 400, body: { success: false, error: 'Invalid profile image type', code: 'VALIDATION_ERROR' } });
                }
                const key = s3Helper.generateS3Key(userContext.tenantId, 'teachers', id, 'profile', file.originalname);
                await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
                fileKeys.profileImageKey = key;
            }

            // resume
            if (files.resume && files.resume[0] && files.resume[0].buffer) {
                const file = files.resume[0];
                if (!s3Helper.validateExtensionForCategory(file.originalname, 'resume')) {
                    await transaction.rollback();
                    return sendError(res, { status: 400, body: { success: false, error: 'Invalid resume type', code: 'VALIDATION_ERROR' } });
                }
                const key = s3Helper.generateS3Key(userContext.tenantId, 'teachers', id, 'resume', file.originalname);
                await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
                fileKeys.resumeKey = key;
            }

            // joiningLetter
            if (files.joiningLetter && files.joiningLetter[0] && files.joiningLetter[0].buffer) {
                const file = files.joiningLetter[0];
                if (!s3Helper.validateExtensionForCategory(file.originalname, 'joining_letter')) {
                    await transaction.rollback();
                    return sendError(res, { status: 400, body: { success: false, error: 'Invalid joining letter type', code: 'VALIDATION_ERROR' } });
                }
                const key = s3Helper.generateS3Key(userContext.tenantId, 'teachers', id, 'joining_letter', file.originalname);
                await uploadBufferToS3(s3Client, S3_BUCKET, key, file.buffer, file.mimetype);
                fileKeys.joiningLetterKey = key;
            }
        }

        // Also accept keys sent in body after presigned upload
        if (req.body.profileImageKey) fileKeys.profileImageKey = req.body.profileImageKey;
        if (req.body.resumeKey) fileKeys.resumeKey = req.body.resumeKey;
        if (req.body.joiningLetterKey) fileKeys.joiningLetterKey = req.body.joiningLetterKey;

        // First handle file-key updates transactionally so old objects are deleted before DB update
        let teacher;
        try {
            // If profile image key present, use repository helper to delete old and update key
            if (fileKeys.profileImageKey) {
                await repos.teacher.handleProfileImageUpdate(id, fileKeys.profileImageKey, userContext, s3Helper, { s3Client, bucket: S3_BUCKET }, transaction);
            }
            if (fileKeys.resumeKey) {
                await repos.teacher.handleResumeUpdate(id, fileKeys.resumeKey, userContext, s3Helper, { s3Client, bucket: S3_BUCKET }, transaction);
            }
            if (fileKeys.joiningLetterKey) {
                await repos.teacher.handleJoiningLetterUpdate(id, fileKeys.joiningLetterKey, userContext, s3Helper, { s3Client, bucket: S3_BUCKET }, transaction);
            }

            // Merge remaining update fields and persist
            const finalUpdateData = { ...updateData };
            teacher = await repos.teacher.updateTeacher(id, finalUpdateData, userContext, transaction);
        } catch (err) {
            throw err;
        }

        await transaction.commit();

        logger.info(`[updateTeacher] ✅ Teacher updated: ${id}`);

        return res.status(200).json({
            success: true,
            message: 'Teacher updated successfully',
            teacher: await convertKeysToUrls(teacher)
        });

    } catch (error) {
        await transaction.rollback();

        logger.error(`[updateTeacher] ❌ Error: ${error.message}`);

        if (error.code === 'NOT_FOUND') {
            return sendError(res, {
                status: 404,
                body: { success: false, error: 'Teacher not found', code: 'NOT_FOUND' }
            });
        }

        if (error.code === 'FORBIDDEN') {
            return sendError(res, {
                status: 403,
                body: { success: false, error: error.message, code: 'FORBIDDEN' }
            });
        }

        if (error.code === 'DUPLICATE_EMAIL') {
            return sendError(res, {
                status: 409,
                body: { success: false, error: error.message, code: 'DUPLICATE_EMAIL' }
            });
        }

        return sendError(res, {
            status: error.status || 500,
            body: { success: false, error: error.message || 'Failed to update teacher' }
        });
    }
});

/**
 * DELETE /api/teachers/:id
 * Soft delete a teacher (and linked user account)
 * 
 * @param {String} id - Teacher ID (UUID)
 * 
 * @returns {200} { success: true, message: "Teacher deleted successfully" }
 * @returns {401} Authentication required
 * @returns {403} Forbidden (insufficient permissions)
 * @returns {404} Teacher not found
 * @returns {500} Server error
 */
const deleteTeacher = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;

    if (!userContext) {
        return sendError(res, {
            status: 401,
            body: { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' }
        });
    }

    const { id } = req.params;
    const transaction = await sequelize.transaction();

    try {
        await repos.teacher.deleteTeacher(id, userContext, transaction);
        await transaction.commit();

        logger.info(`[deleteTeacher] ✅ Teacher soft-deleted: ${id}`);

        return res.status(200).json({
            success: true,
            message: 'Teacher deleted successfully'
        });

    } catch (error) {
        await transaction.rollback();

        logger.error(`[deleteTeacher] ❌ Error: ${error.message}`);

        if (error.code === 'NOT_FOUND') {
            return sendError(res, {
                status: 404,
                body: { success: false, error: 'Teacher not found', code: 'NOT_FOUND' }
            });
        }

        if (error.code === 'FORBIDDEN') {
            return sendError(res, {
                status: 403,
                body: { success: false, error: error.message, code: 'FORBIDDEN' }
            });
        }

        return sendError(res, {
            status: error.status || 500,
            body: { success: false, error: error.message || 'Failed to delete teacher' }
        });
    }
});

module.exports = {
    createTeacher,
    listTeachers,
    getTeacherById,
    updateTeacher,
    presignTeacherUpload,
    deleteTeacher
};
