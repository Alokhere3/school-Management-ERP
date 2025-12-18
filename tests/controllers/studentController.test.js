jest.mock('../../services/studentService');
jest.mock('../../utils/s3Helper');
const studentService = require('../../services/studentService');
const { buildProxyUrl } = require('../../utils/s3Helper');
const controller = require('../../controllers/studentController');

describe('studentController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock buildProxyUrl to return a proxy URL (using default port 3000)
        buildProxyUrl.mockImplementation((key) => key ? `http://localhost:3000/images/${key}` : null);
    });

    test('listStudents responds with paginated data', async () => {
        const req = { user: { tenantId: 't1' }, query: { page: '1', limit: '10' }, permission: { level: 'full' } };
        const res = { json: jest.fn() };
        const next = jest.fn();
        // Mock rows without photoKey or photoUrl so getSignedUrl won't be awaited
        const mockRows = [
            { id: 's1', firstName: 'John', toJSON: () => ({ id: 's1', firstName: 'John' }) },
            { id: 's2', firstName: 'Jane', toJSON: () => ({ id: 's2', firstName: 'Jane' }) }
        ];
        studentService.listStudents.mockResolvedValue({ count: 2, rows: mockRows });

        // Call and await the wrapped controller
        await controller.listStudents(req, res, next);

        expect(studentService.listStudents).toHaveBeenCalledWith('t1', expect.objectContaining({ page: '1', limit: '10' }));
        expect(res.json).toHaveBeenCalled();
        const call = res.json.mock.calls[0][0];
        expect(call.success).toBe(true);
        expect(Array.isArray(call.data)).toBe(true);
    });

    test('createStudent returns created student with 201', async () => {
        const req = { user: { tenantId: 't1' }, body: { admissionNo: 'A1', firstName: 'John', dateOfBirth: '2000-01-01' }, file: { location: 'url' } };
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const res = { status };
        const next = jest.fn();

        studentService.createStudent.mockResolvedValue({ id: 's1', admissionNo: 'A1', toJSON: () => ({ id: 's1', admissionNo: 'A1' }) });

        await controller.createStudent(req, res, next);

        expect(studentService.createStudent).toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(201);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Object) }));
    });

    test('updateStudent returns 404 when not found', async () => {
        const req = { params: { id: 'nope' }, user: { tenantId: 't1' }, body: {} };
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const res = { status };
        const next = jest.fn();

        studentService.updateStudent.mockResolvedValue(null);

        await controller.updateStudent(req, res, next);

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ success: false, error: 'Student not found' });
    });

    test('getStudentById returns student when found', async () => {
        const req = { params: { id: 's1' }, user: { tenantId: 't1' } };
        const res = { json: jest.fn() };
        const next = jest.fn();
        studentService.getStudentById.mockResolvedValue({ id: 's1', firstName: 'John' });

        await controller.getStudentById(req, res, next);

        expect(studentService.getStudentById).toHaveBeenCalledWith('s1', 't1');
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Object) }));
    });

    test('getStudentById returns 404 when not found', async () => {
        const req = { params: { id: 'nope' }, user: { tenantId: 't1' } };
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const res = { status };
        const next = jest.fn();

        studentService.getStudentById.mockResolvedValue(null);

        await controller.getStudentById(req, res, next);

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ success: false, error: 'Student not found' });
    });

    test('deleteStudent removes and returns 204', async () => {
        const req = { params: { id: 's1' }, user: { tenantId: 't1' } };
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const res = { status };
        const next = jest.fn();

        studentService.deleteStudent.mockResolvedValue({ id: 's1' });

        await controller.deleteStudent(req, res, next);

        expect(studentService.deleteStudent).toHaveBeenCalledWith('s1', 't1');
        expect(status).toHaveBeenCalledWith(204);
    });

    test('deleteStudent returns 404 when not found', async () => {
        const req = { params: { id: 'nope' }, user: { tenantId: 't1' } };
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const res = { status };
        const next = jest.fn();

        studentService.deleteStudent.mockResolvedValue(null);

        await controller.deleteStudent(req, res, next);

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ success: false, error: 'Student not found' });
    });
});
