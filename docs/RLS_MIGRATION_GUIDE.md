# RLS Migration Guide

## Overview

This guide walks through migrating controllers from the insecure controller-based RLS approach to the secure, centralized Repository-based RLS enforcement.

## Step-by-Step Migration

### Step 1: Identify Direct Model Access

Search your controller for:
```javascript
const Student = require('../models/Student');
const Staff = require('../models/Staff');

// Direct model access (INSECURE)
Student.findAll({ where: ... })
Student.findOne({ where: ... })
Student.create({ ... })
Student.update({ ... })
Student.destroy({ ... })
```

### Step 2: Add Repository Import

Replace model imports with repository:

```javascript
// Before
const studentService = require('../services/studentService');
const Student = require('../models/Student');

// After
const studentService = require('../services/studentService');
const { RepositoryFactory } = require('../repositories');
const repos = new RepositoryFactory();
```

### Step 3: Remove Unsafe RLS Logic

Remove manual RLS checks:

```javascript
// ❌ Remove this code
function applyRowLevelSecurity(query, req) {
    if (req.permission?.level === 'limited') {
        if (req.user.role === 'teacher') {
            query.teacherId = req.user.id;
        }
    }
    return query;
}

// ❌ Remove this code
if (req.permission?.level === 'limited') {
    if (req.user.role === 'teacher' && student.teacherId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }
}
```

### Step 4: Update Each Controller Method

#### Pattern 1: List/Find All

**Before:**
```javascript
const listStudents = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const query = { tenantId };
    
    if (classId) query.classId = classId;
    applyRowLevelSecurity(query, req);  // ❌ Unsafe
    
    const { count, rows } = await studentService.listStudents(tenantId, { 
        page, limit, query 
    });
    res.json({ success: true, data: rows, pagination: { total: count } });
});
```

**After:**
```javascript
const listStudents = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    const { page = 1, limit = 20, classId } = req.query;
    
    if (!userContext?.tenantId) {
        return sendError(res, { status: 401, body: { error: 'Auth required' } });
    }
    
    // Build filters (no tenantId, no role filters - repo adds these)
    const filters = classId ? { classId } : {};
    const options = { page: Number(page), limit: Number(limit) };
    
    // RLS enforced by repository
    const { count, rows } = await repos.student.findVisibleStudents(
        userContext, 
        filters, 
        options
    );
    
    res.json({ success: true, data: rows, pagination: { total: count } });
});
```

#### Pattern 2: Get By ID

**Before:**
```javascript
const getStudentById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const student = await studentService.getStudentById(req.params.id, tenantId);
    
    if (!student) return res.status(404).json({ error: 'Not found' });
    
    // ❌ Manual RLS check - easy to miss!
    if (req.permission?.level === 'limited') {
        if (req.user.role === 'teacher' && student.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
    }
    
    res.json({ success: true, data: student });
});
```

**After:**
```javascript
const getStudentById = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    
    if (!userContext?.tenantId) {
        return sendError(res, { status: 401, body: { error: 'Auth required' } });
    }
    
    // Repository returns null if user doesn't have access (RLS enforced)
    const student = await repos.student.findStudentById(req.params.id, userContext);
    
    if (!student) {
        return sendError(res, { status: 404, body: { error: 'Not found' } });
    }
    
    res.json({ success: true, data: student });
});
```

#### Pattern 3: Create

**Before:**
```javascript
const createStudent = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    
    const payload = {
        tenantId,  // ❌ Manual tenant assignment
        admissionNo: req.body.admissionNo,
        firstName: req.body.firstName
    };
    
    const student = await studentService.createStudent(payload);
    res.status(201).json({ success: true, data: student });
});
```

**After:**
```javascript
const createStudent = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    
    if (!userContext?.tenantId) {
        return sendError(res, { status: 401, body: { error: 'Auth required' } });
    }
    
    const payload = {
        // ✅ Don't include tenantId - repository enforces it automatically
        admissionNo: req.body.admissionNo,
        firstName: req.body.firstName
    };
    
    const student = await repos.student.createStudent(payload, userContext);
    res.status(201).json({ success: true, data: student });
});
```

#### Pattern 4: Update

**Before:**
```javascript
const updateStudent = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    
    const updates = {
        firstName: req.body.firstName,
        lastName: req.body.lastName
    };
    
    const student = await studentService.updateStudent(req.params.id, tenantId, updates);
    if (!student) return res.status(404).json({ error: 'Not found' });
    
    res.json({ success: true, data: student });
});
```

**After:**
```javascript
const updateStudent = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    const studentId = req.params.id;
    
    if (!userContext?.tenantId) {
        return sendError(res, { status: 401, body: { error: 'Auth required' } });
    }
    
    const updates = {
        firstName: req.body.firstName,
        lastName: req.body.lastName
    };
    
    try {
        // Repository validates access before updating
        await repos.student.updateStudent(studentId, updates, userContext);
        const student = await repos.student.findStudentById(studentId, userContext);
        
        if (!student) {
            return sendError(res, { status: 404, body: { error: 'Not found' } });
        }
        
        res.json({ success: true, data: student });
    } catch (err) {
        if (err.message.includes('INSUFFICIENT_PERMISSIONS')) {
            return sendError(res, { status: 403, body: { error: 'Access denied' } });
        }
        return sendError(res, err, 'Failed to update');
    }
});
```

#### Pattern 5: Delete

**Before:**
```javascript
const deleteStudent = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    
    const result = await studentService.deleteStudent(req.params.id, tenantId);
    if (!result) return res.status(404).json({ error: 'Not found' });
    
    res.status(204).send();
});
```

**After:**
```javascript
const deleteStudent = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    const studentId = req.params.id;
    
    if (!userContext?.tenantId) {
        return sendError(res, { status: 401, body: { error: 'Auth required' } });
    }
    
    try {
        // Repository validates access before deleting
        await repos.student.deleteStudent(studentId, userContext);
        res.status(204).send();
    } catch (err) {
        if (err.message.includes('INSUFFICIENT_PERMISSIONS')) {
            return sendError(res, { status: 403, body: { error: 'Access denied' } });
        }
        return sendError(res, err, 'Failed to delete');
    }
});
```

## Migration Checklist

For each controller:

### Preparation
- [ ] Identify all model access patterns
- [ ] Note which methods need updating
- [ ] Review current RLS rules
- [ ] Create backup of controller

### Implementation
- [ ] Add repository factory import
- [ ] Remove unsafe RLS function
- [ ] Remove model imports
- [ ] Update listStudents/Staff/Users
- [ ] Update getById method
- [ ] Update create method
- [ ] Update update method
- [ ] Update delete method
- [ ] Add error handling for INSUFFICIENT_PERMISSIONS
- [ ] Add error handling for NOT_FOUND

### Testing
- [ ] Test as admin (should see all)
- [ ] Test as teacher (should see only accessible)
- [ ] Test as parent (should see only own children)
- [ ] Test as student (should see only own record)
- [ ] Verify pagination works
- [ ] Verify filters work
- [ ] Verify searches work
- [ ] Verify errors are returned correctly

### Cleanup
- [ ] Remove old service methods if not used elsewhere
- [ ] Update any routes that reference old endpoints
- [ ] Update tests
- [ ] Remove any service-level RLS code
- [ ] Run full test suite

## Controllers to Migrate

Priority order:

1. **High Priority (Data Sensitive)**
   - [ ] studentController.js - ✅ DONE
   - [ ] staffController.js
   - [ ] userController.js
   - [ ] classController.js
   - [ ] permissionController.js
   - [ ] roleController.js

2. **Medium Priority**
   - [ ] rolePermissionController.js
   - [ ] tenantController.js
   - [ ] onboardingController.js

3. **Low Priority (Already Secure)**
   - [ ] attendanceController.js
   - [ ] examController.js
   - [ ] paymentController.js

## Testing the Migration

### Unit Tests

```javascript
describe('StudentController with RLS', () => {
    it('Admin should see all students', async () => {
        const adminContext = { 
            userId: 'admin-1', 
            tenantId: 'tenant-1', 
            role: 'admin' 
        };
        
        const students = await repos.student.findVisibleStudents(adminContext);
        // Should return all students in tenant
    });
    
    it('Teacher should see only their students', async () => {
        const teacherContext = { 
            userId: 'teacher-1', 
            tenantId: 'tenant-1', 
            role: 'teacher' 
        };
        
        const students = await repos.student.findVisibleStudents(teacherContext);
        // Should return only students where teacherId === teacher-1
    });
    
    it('Parent should see only their children', async () => {
        const parentContext = { 
            userId: 'parent-1', 
            tenantId: 'tenant-1', 
            role: 'parent' 
        };
        
        const students = await repos.student.findVisibleStudents(parentContext);
        // Should return only students where parentOf === parent-1
    });
});
```

### Integration Tests

```javascript
// Test cross-tenant isolation
it('User from tenant-1 should not see tenant-2 data', async () => {
    const context = { 
        userId: 'user-1', 
        tenantId: 'tenant-1', 
        role: 'admin' 
    };
    
    // Create student in tenant-1
    const student1 = await repos.student.createStudent(
        { admissionNo: 'STU001', firstName: 'John' }, 
        context
    );
    
    // Create student in tenant-2
    const context2 = { ...context, tenantId: 'tenant-2' };
    const student2 = await repos.student.createStudent(
        { admissionNo: 'STU002', firstName: 'Jane' }, 
        context2
    );
    
    // User from tenant-1 should only see student1
    const students = await repos.student.findVisibleStudents(context);
    expect(students.rows).toHaveLength(1);
    expect(students.rows[0].id).toBe(student1.id);
});
```

## Rollback Strategy

If needed to rollback:

1. Keep old service methods temporarily
2. Create an adapter in controller:
   ```javascript
   // Temporary adapter
   if (process.env.USE_LEGACY_RLS === 'true') {
       // Use old service method
       await studentService.listStudents(tenantId, options);
   } else {
       // Use new repository
       await repos.student.findVisibleStudents(userContext, filters);
   }
   ```
3. Gradually migrate route by route
4. Once all migrated, remove adapter and legacy code

## Verification Queries

Test that tenant isolation is working:

```sql
-- Admin in tenant-1 should see these students
SELECT * FROM students WHERE tenantId = 'tenant-1';

-- Admin in tenant-2 should see different students
SELECT * FROM students WHERE tenantId = 'tenant-2';

-- Teacher should only see students they're assigned to
SELECT * FROM students 
WHERE tenantId = 'tenant-1' 
AND teacherId = 'teacher-user-id';

-- Parent should only see their children
SELECT * FROM students 
WHERE tenantId = 'tenant-1' 
AND parentOf = 'parent-user-id';
```

## Performance Considerations

The repository pattern has the same performance as direct model access:

- Indexes on tenantId and userId ensure fast filtering
- Queries are identical, just executed via repository
- No N+1 query problems introduced
- Pagination handled the same way

Monitor with:
```sql
-- Check index usage
EXPLAIN ANALYZE SELECT * FROM students 
WHERE tenantId = 'tenant-1' 
AND teacherId = 'teacher-id';
```

## Support

For questions during migration:

1. Check [RLS_IMPLEMENTATION.md](./RLS_IMPLEMENTATION.md)
2. Check [RLS_QUICK_REFERENCE.md](./RLS_QUICK_REFERENCE.md)
3. Review updated [studentController.js](../controllers/studentController.js) as example
4. Check test files for usage examples
