const request = require('supertest');
const express = require('express');

// Mocks
jest.mock('../../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn()
}));
jest.mock('../../models/Tenant', () => ({
    create: jest.fn()
}));
jest.mock('../../models/Role', () => ({
    findAll: jest.fn(),
    findOne: jest.fn()
}));
const mockUserRole = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn()
};
jest.mock('../../models/UserRole', () => {
    return {
        findAll: mockUserRole.findAll,
        create: mockUserRole.create,
        findOne: mockUserRole.findOne
    };
}, { virtual: true });
jest.mock('../../models/RolePermission', () => ({
    findAll: jest.fn()
}));
jest.mock('../../middleware/rbac', () => ({
    checkPermission: jest.fn()
}));
jest.mock('../../utils/authorizationHelper', () => ({
    getAllowedAccess: jest.fn(),
    getUserPrimaryRole: jest.fn()
}));
jest.mock('../../controllers/userController', () => ({
    getProfile: jest.fn((req, res) => {
        res.json({ success: true, data: { id: 'test-user', email: 'test@example.com', role: 'Teacher' } });
    })
}));
jest.mock('../../middleware/auth', () => ({
    authenticateToken: jest.fn((req, res, next) => {
        req.user = { userId: 'test-user', id: 'test-user', tenantId: 'test-tenant', roles: ['TEACHER'], role: 'TEACHER' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    enforceTenantScope: jest.fn((req, res, next) => next())
}));
jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
    compare: jest.fn()
}));
jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(() => 'signed-token'),
    verify: jest.fn()
}));

const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const { getAllowedAccess, getUserPrimaryRole } = require('../../utils/authorizationHelper');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Role = require('../../models/Role');
// UserRole is mocked above
const { checkPermission } = require('../../middleware/rbac');

const authRouter = require('../../routes/auth');

describe('auth routes - register/login', () => {
    let app;
    beforeAll(() => {
        // Ensure JWT secret is present for token generation in tests
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
        app = express();
        app.use(express.json());
        
        // Middleware to optionally inject authenticated user for tests
        app.use((req, res, next) => {
            if (req.query.authenticated || req.body?.authenticated) {
                req.user = { id: 'test-user', tenantId: 'test-tenant' };
            }
            next();
        });
        
        app.use('/api/auth', authRouter);
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Reset UserRole mocks
        mockUserRole.findAll.mockClear();
        mockUserRole.create.mockClear();
        mockUserRole.findOne.mockClear();
    });

    test('POST /api/auth/register - missing fields returns 400 with message', async () => {
        const res = await request(app).post('/api/auth/register').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ success: false, error: expect.any(String) }));
    });

    test('POST /api/auth/register - duplicate email returns 409 with code', async () => {
        User.findOne.mockResolvedValue({ id: 'u1' });
        const payload = { name: 'School', email: 'a@b.com', password: 'secret12' };
        const res = await request(app).post('/api/auth/register').send(payload);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ success: false, error: 'Email is already registered', code: 'EMAIL_TAKEN' });
    });

    test('POST /api/auth/register - success returns 201 with token and tenant', async () => {
        User.findOne.mockResolvedValue(null);
        Tenant.create.mockResolvedValue({ id: 't1', name: 'School' });
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockResolvedValue({ id: 'u1', tenantId: 't1', email: 'a@b.com' });
        mockUserRole.findAll.mockResolvedValue([]);
        Role.findAll.mockImplementation((opts) => {
            // When no opts or opts.where is undefined, return all roles (for availableRoles in response)
            if (!opts || !opts.where) {
                return Promise.resolve([]);
            }
            // When searching for specific role names
            if (opts.where && opts.where.name) {
                return Promise.resolve([]);
            }
            return Promise.resolve([]);
        });
        getUserPrimaryRole.mockResolvedValue(null);
        getAllowedAccess.mockResolvedValue({});

        const payload = { name: 'School', email: 'a@b.com', password: 'secret12' };
        const res = await request(app).post('/api/auth/register').send(payload);
        expect(res.status).toBe(201);
        expect(res.body).toEqual(expect.objectContaining({ success: true, token: 'signed-token', tenant: { id: 't1', name: 'School' } }));
        expect(jwt.sign).toHaveBeenCalled();
        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
            passwordHash: 'hashed',
            mustChangePassword: false,
            status: 'active'
        }));
    });

    test('POST /api/auth/register - with roles array assigns roles to user', async () => {
        User.findOne.mockResolvedValue(null);
        Tenant.create.mockResolvedValue({ id: 't1', name: 'School' });
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockResolvedValue({ id: 'u1', tenantId: 't1' });

        // Mock checkPermission to return 'full' (has permission)
        checkPermission.mockResolvedValue('full');

        // Mock role lookup - separate logic for different call patterns
        Role.findAll.mockImplementation((opts) => {
            // When called with where clause (looking for specific roles)
            if (opts && opts.where && opts.where.name) {
                return Promise.resolve([
                    { id: 'r1', name: 'School Admin', description: 'admin', isSystemRole: false }
                ]);
            }
            // When called without args (list all roles for availableRoles)
            return Promise.resolve([]);
        });

        // Mock UserRole.create method
        mockUserRole.create.mockImplementation((data) => Promise.resolve({ 
            id: 'ur1', 
            userId: data.userId, 
            tenantId: data.tenantId, 
            role: data.role 
        }));
        mockUserRole.findAll.mockResolvedValue([
            { id: 'ur1', userId: 'u1', tenantId: 't1', role: 'SCHOOL_ADMIN' }
        ]);
        getUserPrimaryRole.mockResolvedValue({ name: 'School Admin' });
        getAllowedAccess.mockResolvedValue({});
        
        // Mock Role.findOne for Super Admin check
        Role.findOne.mockResolvedValue({ id: 'super-role', name: 'Super Admin', isSystemRole: true });
        // Mock user as Super Admin to pass the check
        mockUserRole.findOne.mockResolvedValue({ 
            id: 'ur-super', 
            userId: 'test-user', 
            tenantId: 'test-tenant', 
            role: 'SUPER_ADMIN' 
        });
        User.create.mockResolvedValue({ id: 'u1', tenantId: 't1', email: 'a@b.com' });

        const payload = { name: 'School', email: 'a@b.com', password: 'secret12', roles: ['School Admin'], authenticated: true };
        const res = await request(app).post('/api/auth/register').send(payload);
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.roles).toBeDefined();
        expect(res.body.roles).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'School Admin' })
        ]));
        expect(mockUserRole.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'u1',
            tenantId: 't1',
            role: 'SCHOOL_ADMIN'
        }));
    });

    test('POST /api/auth/register - with invalid roles returns 400', async () => {
        User.findOne.mockResolvedValue(null);
        Tenant.create.mockResolvedValue({ id: 't1', name: 'School' });
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockResolvedValue({ id: 'u1', tenantId: 't1' });

        // Mock checkPermission to return 'full' (has permission)
        checkPermission.mockResolvedValue('full');

        // Mock role lookup - return empty when looking for NonExistent roles
        // The route now validates roles exist before creating user
        Role.findAll.mockImplementation((opts) => {
            if (opts && opts.where && opts.where.name) {
                // Check if NonExistent is in the requested roles
                const requestedRoles = opts.where.name;
                if (Array.isArray(requestedRoles) && requestedRoles.includes('NonExistent')) {
                    return Promise.resolve([]); // No roles found - should trigger 400
                }
                if (requestedRoles === 'NonExistent') {
                    return Promise.resolve([]); // No roles found
                }
            }
            return Promise.resolve([]);
        });
        
        // Mock Role.findOne for Super Admin check
        Role.findOne.mockResolvedValue(null);
        mockUserRole.findOne.mockResolvedValue(null);

        const payload = { name: 'School', email: 'a@b.com', password: 'secret12', roles: ['NonExistent'], authenticated: true };
        const res = await request(app).post('/api/auth/register').send(payload);
        
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('not found');
        expect(res.body.code).toBe('ROLES_NOT_FOUND');
    });

    test('POST /api/auth/register - with empty roles array returns 400', async () => {
        const payload = { name: 'School', email: 'a@b.com', password: 'secret12', roles: [] };
        const res = await request(app).post('/api/auth/register').send(payload);
        
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('non-empty array');
    });

    test('POST /api/auth/register - with roles not being array returns 400', async () => {
        const payload = { name: 'School', email: 'a@b.com', password: 'secret12', roles: 'School Admin' };
        const res = await request(app).post('/api/auth/register').send(payload);
        
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('array');
    });

    test('POST /api/auth/register - with roles but user lacks permission returns 403', async () => {
        User.findOne.mockResolvedValue(null);
        Tenant.create.mockResolvedValue({ id: 't1', name: 'School' });
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockResolvedValue({ id: 'u1', tenantId: 't1' });

        // Mock checkPermission to return 'none' (no permission to create roles)
        checkPermission.mockResolvedValue('none');
        
        // Mock Role.findOne for Super Admin check - return null so it doesn't hit the Super Admin check
        Role.findOne.mockResolvedValue(null);
        mockUserRole.findOne.mockResolvedValue(null);
        
        // Use a role that doesn't trigger Super Admin check
        Role.findAll.mockImplementation((opts) => {
            if (opts && opts.where && opts.where.name) {
                return Promise.resolve([
                    { id: 'r1', name: 'Teacher', description: 'teacher', isSystemRole: false }
                ]);
            }
            return Promise.resolve([]);
        });
        mockUserRole.create.mockResolvedValue({ id: 'ur1' });
        mockUserRole.findAll.mockResolvedValue([]);
        getUserPrimaryRole.mockResolvedValue(null);
        getAllowedAccess.mockResolvedValue({});

        const payload = { name: 'School', email: 'a@b.com', password: 'secret12', roles: ['Teacher'], authenticated: true };
        const res = await request(app).post('/api/auth/register').send(payload);
        
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('permission');
        expect(res.body.code).toBe('PERMISSION_DENIED');
    });

    test('POST /api/auth/register - with roles and user has permission succeeds', async () => {
        User.findOne.mockResolvedValue(null);
        Tenant.create.mockResolvedValue({ id: 't1', name: 'School' });
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockResolvedValue({ id: 'u1', tenantId: 't1', email: 'a@b.com' });

        // Mock checkPermission to return 'full' (has permission to create roles)
        checkPermission.mockResolvedValue('full');

        // Mock role lookup
        Role.findAll.mockImplementation((opts) => {
            if (opts && opts.where && opts.where.name) {
                return Promise.resolve([
                    { id: 'r1', name: 'School Admin', description: 'admin', isSystemRole: false }
                ]);
            }
            return Promise.resolve([]);
        });

        // Mock UserRole methods
        mockUserRole.create.mockImplementation((data) => Promise.resolve({ 
            id: 'ur1', 
            userId: data.userId, 
            tenantId: data.tenantId, 
            role: data.role 
        }));
        mockUserRole.findAll.mockResolvedValue([
            { id: 'ur1', userId: 'u1', tenantId: 't1', role: 'SCHOOL_ADMIN' }
        ]);
        getUserPrimaryRole.mockResolvedValue({ name: 'School Admin' });
        getAllowedAccess.mockResolvedValue({});
        
        // Mock Role.findOne for Super Admin check - return Super Admin role
        Role.findOne.mockResolvedValue({ id: 'super-role', name: 'Super Admin', isSystemRole: true });
        // Mock user as Super Admin to pass the check
        mockUserRole.findOne.mockResolvedValue({ 
            id: 'ur-super', 
            userId: 'test-user', 
            tenantId: 'test-tenant', 
            role: 'SUPER_ADMIN' 
        });

        const payload = { name: 'School', email: 'a@b.com', password: 'secret12', roles: ['School Admin'], authenticated: true };
        const res = await request(app).post('/api/auth/register').send(payload);
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.roles).toBeDefined();
        expect(checkPermission).toHaveBeenCalledWith(expect.any(Object), 'user_management', 'create');
        expect(mockUserRole.create).toHaveBeenCalledWith(expect.objectContaining({
            role: 'SCHOOL_ADMIN'
        }));
    });

    test('POST /api/auth/register - Sequelize unique constraint error returns 400 with field message', async () => {
        // Simulate no existing user
        User.findOne.mockResolvedValue(null);
        // Simulate Tenant.create succeeds
        Tenant.create.mockResolvedValue({ id: 't1', name: 'School' });
        // Simulate User.create throws a unique constraint error
        const uniqueErr = new Error('unique');
        uniqueErr.name = 'SequelizeUniqueConstraintError';
        uniqueErr.errors = [{ path: 'email', message: 'email must be unique' }];
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockRejectedValueOnce(uniqueErr);

        const payload = { name: 'School', email: 'dup@b.com', password: 'secret12' };
        const res = await request(app).post('/api/auth/register').send(payload);
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ success: false, error: 'email already exists', code: 'EMAIL_TAKEN' });
    });

    test('POST /api/auth/register - Sequelize validation error returns 400 with details', async () => {
        User.findOne.mockResolvedValue(null);
        Tenant.create.mockResolvedValue({ id: 't2', name: 'School2' });
        const valErr = new Error('validation');
        valErr.name = 'SequelizeValidationError';
        valErr.errors = [{ message: 'Name is required' }, { message: 'Email is invalid' }];
        bcrypt.hash.mockResolvedValue('hashed');
        User.create.mockRejectedValueOnce(valErr);

    // Provide valid-looking input so route validation passes and the mocked
    // SequelizeValidationError thrown from User.create is exercised.
    const payload = { name: 'School', email: 'bad@example.com', password: 'secret12' };
        const res = await request(app).post('/api/auth/register').send(payload);
        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ success: false, error: 'Validation error', details: expect.any(Array) }));
        expect(res.body.details).toEqual(['Name is required', 'Email is invalid']);
    });

    test('POST /api/auth/login - invalid credentials returns 401', async () => {
        User.findOne.mockResolvedValue(null);
        const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'nope' });
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ success: false, error: 'Invalid credentials' });
    });

    test('POST /api/auth/login - inactive account returns 403', async () => {
        const user = { id: 'u1', email: 'inactive@school.com', tenantId: 't1', passwordHash: 'hashed', status: 'inactive' };
        User.findOne.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        
        const res = await request(app).post('/api/auth/login').send({ email: 'inactive@school.com', password: 'password' });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ success: false, error: 'Account is inactive', code: 'ACCOUNT_INACTIVE' });
    });

    test('POST /api/auth/login - mustChangePassword returns tempToken', async () => {
        const user = { 
            id: 'u1', 
            email: 'newuser@school.com', 
            tenantId: 't1', 
            passwordHash: 'hashed', 
            status: 'active',
            mustChangePassword: true
        };
        User.findOne.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('temp-token');
        
        const res = await request(app).post('/api/auth/login').send({ email: 'newuser@school.com', password: 'password' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.requiresPasswordReset).toBe(true);
        expect(res.body.tempToken).toBe('temp-token');
        expect(res.body.message).toContain('Password change required');
    });

    test('POST /api/auth/login - success returns token with user roles and allowed access', async () => {
        const user = { 
            id: 'u1', 
            email: 'teacher@school.com', 
            tenantId: 't1', 
            passwordHash: 'hashed', 
            status: 'active',
            mustChangePassword: false
        };
        User.findOne.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('login-token');
        
        // Mock UserRole.findAll to return roles
        mockUserRole.findAll.mockResolvedValue([
            { id: 'ur1', userId: 'u1', tenantId: 't1', role: 'TEACHER' }
        ]);
        
        getUserPrimaryRole.mockResolvedValue({
            id: 'role-1',
            name: 'Teacher',
            description: 'Teaching staff'
        });
        
        getAllowedAccess.mockResolvedValue({
            students: ['read'],
            attendance_students: ['read', 'create'],
            timetable: ['read']
        });

        const res = await request(app).post('/api/auth/login').send({ email: 'teacher@school.com', password: 'password' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBe('login-token');
        expect(res.body.user).toBeDefined();
        expect(res.body.user.id).toBe('u1');
        expect(res.body.user.email).toBe('teacher@school.com');
        expect(res.body.user.roles).toEqual(['TEACHER']);
        expect(res.body.user.role).toBe('TEACHER');
        expect(res.body.user.allowedAccess).toEqual({
            students: ['read'],
            attendance_students: ['read', 'create'],
            timetable: ['read']
        });
    });

    test('POST /api/auth/login - includes allowed actions for each module', async () => {
        const user = { 
            id: 'u2', 
            email: 'accountant@school.com', 
            tenantId: 't1', 
            passwordHash: 'hashed', 
            status: 'active',
            mustChangePassword: false
        };
        User.findOne.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('login-token');
        
        mockUserRole.findAll.mockResolvedValue([
            { id: 'ur2', userId: 'u2', tenantId: 't1', role: 'ACCOUNTANT' }
        ]);
        
        getUserPrimaryRole.mockResolvedValue({
            id: 'role-2',
            name: 'Accountant',
            description: 'Financial management'
        });
        
        getAllowedAccess.mockResolvedValue({
            fees: ['read', 'create', 'update'],
            payroll: ['read']
        });

        const res = await request(app).post('/api/auth/login').send({ email: 'accountant@school.com', password: 'password' });
        expect(res.status).toBe(200);
        expect(res.body.user.roles).toEqual(['ACCOUNTANT']);
        expect(res.body.user.role).toBe('ACCOUNTANT');
        expect(res.body.user.allowedAccess.fees).toContain('read');
        expect(res.body.user.allowedAccess.fees).toContain('create');
        expect(res.body.user.allowedAccess.payroll).toContain('read');
    });

    test('POST /api/auth/login - tenant-scoped email lookup', async () => {
        const user = { 
            id: 'u1', 
            email: 'teacher@school.com', 
            tenantId: 't1', 
            passwordHash: 'hashed', 
            status: 'active',
            mustChangePassword: false
        };
        User.findOne.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('login-token');
        
        mockUserRole.findAll.mockResolvedValue([
            { id: 'ur1', userId: 'u1', tenantId: 't1', role: 'TEACHER' }
        ]);
        
        getUserPrimaryRole.mockResolvedValue({ name: 'Teacher' });
        getAllowedAccess.mockResolvedValue({});
        
        const res = await request(app).post('/api/auth/login').send({ 
            email: 'teacher@school.com', 
            password: 'password',
            tenantId: 't1'
        });
        expect(res.status).toBe(200);
        expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'teacher@school.com', tenantId: 't1' } });
    });

    test('GET /api/auth/profile - returns user profile with role and allowed access', async () => {
        const res = await request(app).get('/api/auth/profile');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.id).toBe('test-user');
        expect(res.body.data.role).toBe('Teacher');
    });

    test('GET /api/auth/available-roles - School Admin gets tenant-scoped roles (subset check)', async () => {
        // Mock primary role as School Admin
        getUserPrimaryRole.mockResolvedValue({ id: 'r-school', name: 'School Admin', isSystemRole: false });
        checkPermission.mockResolvedValue('full');

        // Creator's allowed actions: School Admin has full on students and fees
        getAllowedAccess.mockResolvedValue({
            students: ['read', 'create', 'update', 'delete'],
            fees: ['read', 'create', 'update']
        });

        // Roles in DB: system roles + tenant roles
        Role.findAll.mockResolvedValue([
            { id: 'sys-1', tenantId: null, name: 'Super Admin', isSystemRole: true, description: 'sys' },
            { id: 't1', tenantId: 'test-tenant', name: 'Teacher', isSystemRole: false, description: 'teacher' },
            { id: 't2', tenantId: 'test-tenant', name: 'Accountant', isSystemRole: false, description: 'acct' },
            { id: 'other', tenantId: 'other-tenant', name: 'Other', isSystemRole: false, description: 'other' }
        ]);

        // RolePermission mapping for roles: Teacher requires students:read (subset OK), Accountant requires fees:create & read (subset OK)
        const RolePermission = require('../../models/RolePermission');
        RolePermission.findAll.mockImplementation(({ where: { roleId } }) => {
            if (roleId === 't1') {
                return Promise.resolve([{ permission: { resource: 'students', action: 'read' } }]);
            }
            if (roleId === 't2') {
                return Promise.resolve([{ permission: { resource: 'fees', action: 'read' } }, { permission: { resource: 'fees', action: 'create' } }]);
            }
            return Promise.resolve([]);
        });

        const res = await request(app).get('/api/auth/available-roles');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        // School Admin should see tenant-scoped roles for their tenant that are subsets
        const names = res.body.data.map(r => r.name);
        expect(names).toContain('Teacher');
        expect(names).toContain('Accountant');
        expect(names).not.toContain('Super Admin');
    });

    test('GET /api/auth/available-roles - Super Admin querying tenant gets system + tenant roles', async () => {
        // Set auth middleware to simulate super admin (system-level)
        const auth = require('../../middleware/auth');
        auth.authenticateToken.mockImplementation((req, res, next) => {
            req.user = { id: 'super-user', tenantId: null };
            next();
        });

        // Primary role is system-level
        getUserPrimaryRole.mockResolvedValue({ id: 'r-super', name: 'Super Admin', isSystemRole: true });
        checkPermission.mockResolvedValue('full');
        // Super Admin allowed actions (include tenant_management:create) so subset check passes
        getAllowedAccess.mockResolvedValue({ tenant_management: ['create'], students: ['read'] });

        Role.findAll.mockResolvedValue([
            { id: 'sys-1', tenantId: null, name: 'Super Admin', isSystemRole: true, description: 'sys' },
            { id: 't1', tenantId: 'new-tenant', name: 'School Admin', isSystemRole: false, description: 'school admin' }
        ]);

        const RolePermission = require('../../models/RolePermission');
        RolePermission.findAll.mockImplementation(({ where: { roleId } }) => {
            if (roleId === 'sys-1') return Promise.resolve([{ permission: { resource: 'tenant_management', action: 'create' } }]);
            if (roleId === 't1') return Promise.resolve([{ permission: { resource: 'students', action: 'read' } }]);
            return Promise.resolve([]);
        });

        const res = await request(app).get('/api/auth/available-roles').query({ tenantId: 'new-tenant' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const names = res.body.data.map(r => r.name);
        expect(names).toContain('Super Admin');
        expect(names).toContain('School Admin');
    });

    test('POST /api/auth/reset-password - missing fields returns 400', async () => {
        const res = await request(app).post('/api/auth/reset-password').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('required') }));
    });

    test('POST /api/auth/reset-password - invalid token returns 401', async () => {
        const jwt = require('jsonwebtoken');
        jwt.verify.mockImplementation(() => {
            throw new Error('Invalid token');
        });
        
        const res = await request(app).post('/api/auth/reset-password').send({
            tempToken: 'invalid-token',
            newPassword: 'newpass123'
        });
        expect(res.status).toBe(401);
        expect(res.body).toEqual(expect.objectContaining({ success: false, error: 'Invalid token' }));
    });

    test('POST /api/auth/reset-password - expired token returns 401', async () => {
        const jwt = require('jsonwebtoken');
        const expiredError = new Error('Token expired');
        expiredError.name = 'TokenExpiredError';
        jwt.verify.mockImplementation(() => {
            throw expiredError;
        });
        
        const res = await request(app).post('/api/auth/reset-password').send({
            tempToken: 'expired-token',
            newPassword: 'newpass123'
        });
        expect(res.status).toBe(401);
        expect(res.body).toEqual(expect.objectContaining({ 
            success: false, 
            error: expect.stringContaining('expired'),
            code: 'TOKEN_EXPIRED'
        }));
    });

    test('POST /api/auth/reset-password - success resets password and returns token', async () => {
        const jwt = require('jsonwebtoken');
        const user = { 
            id: 'u1', 
            userId: 'u1',
            email: 'user@school.com', 
            tenantId: 't1', 
            passwordHash: 'old-hash',
            status: 'active',
            update: jest.fn().mockResolvedValue(true)
        };
        
        User.findByPk = jest.fn().mockResolvedValue(user);
        jwt.verify.mockReturnValue({ userId: 'u1', tenantId: 't1', type: 'password_reset' });
        bcrypt.hash.mockResolvedValue('new-hash');
        jwt.sign.mockReturnValue('new-token');
        
        mockUserRole.findAll.mockResolvedValue([
            { id: 'ur1', userId: 'u1', tenantId: 't1', role: 'TEACHER' }
        ]);
        getUserPrimaryRole.mockResolvedValue({ name: 'Teacher' });
        getAllowedAccess.mockResolvedValue({ students: ['read'] });
        
        const res = await request(app).post('/api/auth/reset-password').send({
            tempToken: 'valid-token',
            newPassword: 'newpass123'
        });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBe('new-token');
        expect(res.body.user).toBeDefined();
        expect(res.body.user.roles).toEqual(['TEACHER']);
        expect(user.update).toHaveBeenCalledWith(expect.objectContaining({
            passwordHash: 'new-hash',
            mustChangePassword: false
        }));
    });

    test('POST /api/auth/reset-password - password too short returns 400', async () => {
        const res = await request(app).post('/api/auth/reset-password').send({
            tempToken: 'valid-token',
            newPassword: 'short'
        });
        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ 
            success: false, 
            error: expect.stringContaining('8 characters')
        }));
    });
});
