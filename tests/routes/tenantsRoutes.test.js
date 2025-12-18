const request = require('supertest');
const express = require('express');

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({ 
    authenticateToken: (req, res, next) => {
        req.user = { userId: 'test-user', id: 'test-user', tenantId: 't1', roles: ['ADMIN'], role: 'ADMIN' };
        next();
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

// Mock controller so tests are isolated
const mockController = {
    listTenants: jest.fn((req, res) => res.json({ success: true, data: [{ id: 't1' }] })),
    createTenant: jest.fn((req, res) => res.status(201).json({ success: true, data: { id: 't2', name: req.body.name } })),
    getTenantById: jest.fn((req, res) => res.json({ success: true, data: { id: req.params.id } })),
    updateTenant: jest.fn((req, res) => res.json({ success: true, data: { id: req.params.id } })),
    deleteTenant: jest.fn((req, res) => res.status(204).end())
};

jest.mock('../../controllers/tenantController', () => mockController);

const tenantsRouter = require('../../routes/tenants');

describe('tenants routes', () => {
    let app;
    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/tenants', tenantsRouter);
    });

    afterEach(() => jest.clearAllMocks());

    test('GET /api/tenants returns list', async () => {
        const res = await request(app).get('/api/tenants');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ success: true, data: expect.any(Array) }));
    });

    test('POST /api/tenants validation fails when name missing', async () => {
        const res = await request(app).post('/api/tenants').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ success: false, error: 'Validation failed', details: expect.any(Array) }));
    });

    test('POST /api/tenants success returns 201', async () => {
        const res = await request(app).post('/api/tenants').send({ name: 'New School' });
        expect(res.status).toBe(201);
        expect(res.body).toEqual(expect.objectContaining({ success: true, data: expect.objectContaining({ name: 'New School' }) }));
    });

    test('GET/PUT/DELETE /api/tenants/:id routes call controller', async () => {
        await request(app).get('/api/tenants/t1');
        await request(app).put('/api/tenants/t1').send({ name: 'Updated' });
        await request(app).delete('/api/tenants/t1');
        expect(mockController.getTenantById).toHaveBeenCalled();
        expect(mockController.updateTenant).toHaveBeenCalled();
        expect(mockController.deleteTenant).toHaveBeenCalled();
    });
});
