const mockStudent = {
    id: 's1',
    tenantId: 't1',
    admissionNo: 'A001',
    firstName: 'John',
    lastName: 'Doe',
    update: jest.fn(function (updates) { Object.assign(this, updates); return this; })
};

jest.mock('../../models/Student', () => ({
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn()
}));

const Student = require('../../models/Student');
const service = require('../../services/studentService');

describe('studentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('listStudents returns count and rows', async () => {
        Student.findAndCountAll.mockResolvedValue({ count: 1, rows: [mockStudent] });
        const result = await service.listStudents('t1', { page: 1, limit: 10 });
        expect(Student.findAndCountAll).toHaveBeenCalled();
        expect(result.count).toBe(1);
        expect(result.rows).toHaveLength(1);
    });

    test('createStudent forwards to Student.create', async () => {
        Student.create.mockResolvedValue(mockStudent);
        const payload = { tenantId: 't1', admissionNo: 'A002' };
        const created = await service.createStudent(payload);
        expect(Student.create).toHaveBeenCalledWith(payload);
        expect(created).toBe(mockStudent);
    });

    test('updateStudent updates and returns student', async () => {
        Student.findOne.mockResolvedValue(Object.assign({}, mockStudent));
        const updated = await service.updateStudent('s1', 't1', { firstName: 'Jane' });
        // Since we returned a plain object without update method, updated should be null
        // Now simulate a student with update method
        const sWithUpdate = { ...mockStudent, update: jest.fn().mockResolvedValue(Object.assign({}, mockStudent, { firstName: 'Jane' })) };
        Student.findOne.mockResolvedValueOnce(sWithUpdate);
        const updated2 = await service.updateStudent('s1', 't1', { firstName: 'Jane' });
        expect(sWithUpdate.update).toHaveBeenCalledWith({ firstName: 'Jane' });
        expect(updated2.firstName).toBe('Jane');
    });

    // Negative/error path tests
    test('listStudents throws error when DB query fails', async () => {
        const dbError = new Error('DB Connection failed');
        Student.findAndCountAll.mockRejectedValue(dbError);
        await expect(service.listStudents('t1')).rejects.toThrow('DB Connection failed');
    });

    test('createStudent throws error when DB create fails', async () => {
        const dbError = new Error('Duplicate entry');
        Student.create.mockRejectedValue(dbError);
        await expect(service.createStudent({ admissionNo: 'A001' })).rejects.toThrow('Duplicate entry');
    });

    test('getStudentById returns null when student not found', async () => {
        Student.findOne.mockResolvedValue(null);
        const result = await service.getStudentById('nonexistent', 't1');
        expect(result).toBeNull();
    });

    test('getStudentById throws error when DB query fails', async () => {
        const dbError = new Error('Query error');
        Student.findOne.mockRejectedValue(dbError);
        await expect(service.getStudentById('s1', 't1')).rejects.toThrow('Query error');
    });

    test('updateStudent returns null when student not found', async () => {
        Student.findOne.mockResolvedValue(null);
        const result = await service.updateStudent('nonexistent', 't1', { firstName: 'Jane' });
        expect(result).toBeNull();
        expect(Student.findOne).toHaveBeenCalledWith({ where: { id: 'nonexistent', tenantId: 't1' } });
    });

    test('updateStudent throws error when update fails', async () => {
        const sWithUpdate = { ...mockStudent, update: jest.fn().mockRejectedValue(new Error('Update failed')) };
        Student.findOne.mockResolvedValue(sWithUpdate);
        await expect(service.updateStudent('s1', 't1', { firstName: 'Jane' })).rejects.toThrow('Update failed');
    });

    test('deleteStudent returns null when student not found', async () => {
        Student.findOne.mockResolvedValue(null);
        const result = await service.deleteStudent('nonexistent', 't1');
        expect(result).toBeNull();
    });

    test('deleteStudent destroys and returns student', async () => {
        const sWithDestroy = { ...mockStudent, destroy: jest.fn().mockResolvedValue(undefined) };
        Student.findOne.mockResolvedValue(sWithDestroy);
        const result = await service.deleteStudent('s1', 't1');
        expect(sWithDestroy.destroy).toHaveBeenCalled();
        expect(result).toBe(sWithDestroy);
    });

    test('deleteStudent throws error when destroy fails', async () => {
        const sWithDestroy = { ...mockStudent, destroy: jest.fn().mockRejectedValue(new Error('Delete failed')) };
        Student.findOne.mockResolvedValue(sWithDestroy);
        await expect(service.deleteStudent('s1', 't1')).rejects.toThrow('Delete failed');
    });
});
