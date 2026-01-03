const asyncHandler = require('../utils/asyncHandler');
const studentService = require('../services/studentService');
const { extractKeyFromUrl, buildProxyUrl } = require('../utils/s3Helper');

// GET /api/students
const { sendError } = require('../utils/errorMapper');

/**
 * Helper: Apply row-level security filtering based on permission level
 * level === 'limited' means user should only see own records
 */
function applyRowLevelSecurity(query, req) {
    // If user has limited access, filter by ownership
    if (req.permission && req.permission.level === 'limited') {
        // Teachers see own students
        // Parents see own child
        // Students see own records
        // For now, implement teacher filtering - can be extended
        if (req.user.role === 'teacher') {
            query.teacherId = req.user.id;
        } else if (req.user.role === 'parent') {
            // Parents can see their child's records
            query.parentOf = req.user.id;
        } else if (req.user.role === 'student') {
            // Students can see their own records
            query.userId = req.user.id;
        }
    }
    return query;
}

// GET /api/students
const listStudents = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const tenantId = req.user && (req.user.tenantId || req.user.tenantId);
    if (!tenantId) return sendError(res, { status: 400, body: { success: false, error: 'tenantId missing from token', code: 'TENANT_REQUIRED' } });
    
    try {
        // Apply row-level security
        const query = { tenantId };
        applyRowLevelSecurity(query, req);
        
        const { count, rows } = await studentService.listStudents(tenantId, { page, limit, query });
        // Convert S3 URLs to proxy URLs (backend serves images)
        const dataWithProxyUrls = rows.map((student) => {
            const s = student.toJSON ? student.toJSON() : student;
            let key = s.photoKey;
            if (!key && s.photoUrl) {
                key = extractKeyFromUrl(s.photoUrl);
            }
            if (key) {
                // Return proxy URL like http://localhost:5000/images/tenants/123/photo.jpg
                s.photoUrl = buildProxyUrl(key);
            } else {
                s.photoUrl = null;
            }
            return s;
        });
        res.json({ success: true, data: dataWithProxyUrls, pagination: { total: count, pages: Math.ceil(count / limit), current: Number(page) } });
    } catch (err) {
        // add diagnostic info and delegate to sendError
        // eslint-disable-next-line no-console
        console.error('Error listing students:', err && (err.sql || err.message || err));
        return sendError(res, err, 'Failed to list students');
    }
});

// POST /api/students/onboarding - Start a new onboarding record (partial student)
const startOnboarding = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) return sendError(res, { status: 400, body: { success: false, error: 'tenantId missing', code: 'TENANT_REQUIRED' } });

    const { onboardingData, step } = req.body || {};
    const payload = {
        tenantId,
        onboardingData: onboardingData || {},
        onboardingStep: step || 1,
        onboardingCompleted: false,
        status: 'active'
    };

    const student = await studentService.createStudent(payload);
    const s = student.toJSON ? student.toJSON() : student;
    res.status(201).json({ success: true, data: s });
});

// PATCH /api/students/:id/onboarding - Update onboarding step/data for an existing student
const updateOnboarding = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    const id = req.params.id;
    if (!tenantId) return sendError(res, { status: 400, body: { success: false, error: 'tenantId missing', code: 'TENANT_REQUIRED' } });

    const { onboardingData, step, completed } = req.body || {};
    const student = await studentService.getStudentById(id, tenantId);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    const updates = {};
    if (onboardingData !== undefined) updates.onboardingData = Object.assign({}, student.onboardingData || {}, onboardingData);
    if (step !== undefined) updates.onboardingStep = step;
    if (completed !== undefined) updates.onboardingCompleted = Boolean(completed);

    const updated = await studentService.updateStudent(id, tenantId, updates);
    const s = updated.toJSON ? updated.toJSON() : updated;
    res.json({ success: true, data: s });
});

// POST /api/students
const createStudent = asyncHandler(async (req, res) => {
	const tenantId = req.user && req.user.tenantId;
    const payload = {
		tenantId,
		admissionNo: req.body.admissionNo,
		firstName: req.body.firstName,
		lastName: req.body.lastName || '',
		dateOfBirth: req.body.dateOfBirth,
        photoUrl: req.file ? req.file.location : null,
        photoKey: req.file ? (req.file.key || req.file.fieldname || null) : null,
		status: 'active'
	};

	const student = await studentService.createStudent(payload);
    // Convert S3 URL to proxy URL (backend serves images)
    const s = student.toJSON ? student.toJSON() : student;
    let key = s.photoKey;
    if (!key && s.photoUrl) {
        key = extractKeyFromUrl(s.photoUrl);
    }
    if (key) {
        // Return proxy URL like http://localhost:5000/images/tenants/123/photo.jpg
        s.photoUrl = buildProxyUrl(key);
    } else {
        s.photoUrl = null;
    }
    res.status(201).json({ success: true, data: s });
});

// PUT /api/students/:id
const updateStudent = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    const updates = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        photoUrl: req.file ? req.file.location : undefined,
        photoKey: req.file ? (req.file.key || req.file.fieldname || undefined) : undefined
    };
    // remove undefined fields
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    const student = await studentService.updateStudent(req.params.id, tenantId, updates);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    const s = student.toJSON ? student.toJSON() : student;
    let key = s.photoKey;
    if (!key && s.photoUrl) {
        key = extractKeyFromUrl(s.photoUrl);
    }
    if (key) {
        // Return proxy URL like http://localhost:5000/images/tenants/123/photo.jpg
        s.photoUrl = buildProxyUrl(key);
    } else {
        s.photoUrl = null;
    }
    res.json({ success: true, data: s });
});

// GET /api/students/:id
const getStudentById = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    const student = await studentService.getStudentById(req.params.id, tenantId);
    
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    
    // Check row-level security: if limited access, verify ownership
    if (req.permission && req.permission.level === 'limited') {
        if (req.user.role === 'teacher' && student.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied: You can only view your own students' });
        }
        if (req.user.role === 'student' && student.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied: You can only view your own record' });
        }
    }
    
    const s = student.toJSON ? student.toJSON() : student;
    let key = s.photoKey;
    if (!key && s.photoUrl) {
        key = extractKeyFromUrl(s.photoUrl);
    }
    if (key) {
        // Return proxy URL like http://localhost:5000/images/tenants/123/photo.jpg
        s.photoUrl = buildProxyUrl(key);
    } else {
        s.photoUrl = null;
    }
    res.json({ success: true, data: s });
});

// DELETE /api/students/:id
const deleteStudent = asyncHandler(async (req, res) => {
    const tenantId = req.user && req.user.tenantId;
    const student = await studentService.deleteStudent(req.params.id, tenantId);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    res.status(204).json();
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