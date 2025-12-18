const request = require('supertest');
const express = require('express');

// Mock auth middleware to inject a tenant on req.user
jest.mock('../../middleware/auth', () => ({
    authenticateToken: (req, res, next) => { 
        req.user = { userId: 'test-user', id: 'test-user', tenantId: 't1', roles: ['TEACHER'], role: 'TEACHER' }; 
        return next(); 
    },
    requireRole: jest.fn(() => (req, res, next) => next()),
    enforceTenantScope: jest.fn((req, res, next) => next())
}));

// Mock RBAC middleware
jest.mock('../../middleware/rbac', () => ({ 
    authorize: (resource, action) => (req, res, next) => {
        req.permission = { resource, action, level: 'full', userRoles: [] };
        next();
    }
}));

// Mock upload middleware (multer/s3) to just pass through
jest.mock('../../config/s3', () => ({
    upload: { single: () => (req, res, next) => next() }
}));

// Mock the controller so we don't hit DB/services
const mockController = {
    createStudent: jest.fn((req, res) => res.status(201).json({ success: true, data: { id: 's1' } })),
    getStudentById: jest.fn((req, res) => res.json({ success: true, data: { id: req.params.id, firstName: 'John' } })),
    updateStudent: jest.fn((req, res) => res.json({ success: true, data: { id: req.params.id } })),
    deleteStudent: jest.fn((req, res) => res.status(204).end())
};

jest.mock('../../controllers/studentController', () => mockController);

const studentsRouter = require('../../routes/students');

describe('students routes', () => {
    let app;
    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/students', studentsRouter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('POST /api/students validation fails when required fields missing', async () => {
        const res = await request(app).post('/api/students').send({ firstName: 'NoAdmission' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ success: false, error: expect.any(String), details: expect.any(Array) }));
    });

    test('POST /api/students success returns 201 and created student', async () => {
        const payload = { admissionNo: 'A100', firstName: 'Jane', dateOfBirth: '2010-01-01' };
        const res = await request(app).post('/api/students').send(payload);
        expect(res.status).toBe(201);
        expect(res.body).toEqual(expect.objectContaining({ success: true, data: expect.objectContaining({ id: 's1' }) }));
        expect(mockController.createStudent).toHaveBeenCalled();
    });

    test('GET /api/students/:id returns student', async () => {
        const res = await request(app).get('/api/students/s1');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ success: true, data: expect.objectContaining({ id: 's1' }) }));
        expect(mockController.getStudentById).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), expect.any(Function));
    });

    test('DELETE /api/students/:id returns 204 when deleted', async () => {
        const res = await request(app).delete('/api/students/s1');
        expect(res.status).toBe(204);
        expect(mockController.deleteStudent).toHaveBeenCalled();
    });
});
