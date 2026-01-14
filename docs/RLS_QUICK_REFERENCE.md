# RLS Quick Reference

## CRITICAL RULE

**All data access must flow through repositories. Direct model access is forbidden.**

```javascript
// ❌ FORBIDDEN - This bypasses RLS!
Student.findAll({ where: { tenantId } })

// ✅ REQUIRED - This enforces RLS
const students = await studentRepo.findVisibleStudents(userContext, filters, options)
```

## Repository Methods

### StudentRepository

```javascript
// List students (with RLS)
const { count, rows } = await studentRepo.findVisibleStudents(userContext, filters, options);

// Single student (with RLS)
const student = await studentRepo.findStudentById(id, userContext);

// Create (auto-enforces tenant isolation)
const student = await studentRepo.createStudent(data, userContext);

// Update (with RLS)
await studentRepo.updateStudent(id, updates, userContext);

// Delete (with RLS)
await studentRepo.deleteStudent(id, userContext);

// By class
const students = await studentRepo.findStudentsByClass(classId, userContext);

// By parent
const students = await studentRepo.findStudentsByParent(parentId, userContext);

// By teacher
const students = await studentRepo.findStudentsByTeacher(teacherId, userContext);

// Count
const count = await studentRepo.countVisibleStudents(userContext, filters);

// Search
const results = await studentRepo.searchStudents(term, userContext);
```

### StaffRepository

```javascript
// List staff (with RLS)
const { count, rows } = await staffRepo.findVisibleStaff(userContext, filters, options);

// Single staff
const staff = await staffRepo.findStaffById(id, userContext);

// Create
const staff = await staffRepo.createStaff(data, userContext);

// Update
await staffRepo.updateStaff(id, updates, userContext);

// Delete
await staffRepo.deleteStaff(id, userContext);

// By department
const staff = await staffRepo.findStaffByDepartment(dept, userContext);

// By designation
const staff = await staffRepo.findStaffByDesignation(desig, userContext);

// Teachers only
const teachers = await staffRepo.findTeachers(userContext);

// Count
const count = await staffRepo.countVisibleStaff(userContext, filters);

// Search
const results = await staffRepo.searchStaff(term, userContext);
```

### UserRepository

```javascript
// List users (with RLS)
const { count, rows } = await userRepo.findVisibleUsers(userContext, filters, options);

// Single user
const user = await userRepo.findUserById(id, userContext);

// Create
const user = await userRepo.createUser(data, userContext);

// Update
await userRepo.updateUser(id, updates, userContext);

// Delete
await userRepo.deleteUser(id, userContext);

// By role
const users = await userRepo.findUsersByRole(role, userContext);

// Search
const results = await userRepo.searchUsers(term, userContext);
```

### ClassRepository

```javascript
// List classes (with RLS)
const { count, rows } = await classRepo.findVisibleClasses(userContext, filters, options);

// Single class
const class = await classRepo.findClassById(id, userContext);

// Create
const class = await classRepo.createClass(data, userContext);

// Update
await classRepo.updateClass(id, updates, userContext);

// Delete
await classRepo.deleteClass(id, userContext);

// By teacher
const classes = await classRepo.findClassesByTeacher(teacherId, userContext);

// By session
const classes = await classRepo.findClassesBySession(session, userContext);

// Count
const count = await classRepo.countVisibleClasses(userContext, filters);
```

## RLS Rules by Entity

### Students

| Role | Can See |
|------|---------|
| Admin | All students in tenant |
| Teacher | Students in their classes |
| Parent | Only their children |
| Student | Only own record |

### Staff

| Role | Can See |
|------|---------|
| Admin | All staff |
| HR Manager | All staff |
| Principal | All staff |
| Staff | Only own record |

### Users

| Role | Can See |
|------|---------|
| Admin | All users |
| User | Only own record |

### Classes

| Role | Can See |
|------|---------|
| Admin | All classes |
| Teacher | Classes they teach |
| Student | Only own class |

## Usage Pattern in Controllers

```javascript
const { RepositoryFactory } = require('../repositories');
const repos = new RepositoryFactory();

const listStudents = asyncHandler(async (req, res) => {
    // 1. Get user context (from middleware)
    const userContext = req.userContext || req.user;
    
    // 2. Validate
    if (!userContext || !userContext.tenantId) {
        return sendError(res, { status: 401, body: { error: 'Auth required' } });
    }
    
    // 3. Build filters (NOT including tenantId or role filters - repo does that)
    const filters = req.query.classId ? { classId: req.query.classId } : {};
    const options = { page: req.query.page, limit: req.query.limit };
    
    // 4. Call repository with userContext - RLS ENFORCED
    const { count, rows } = await repos.student.findVisibleStudents(
        userContext,
        filters,
        options
    );
    
    // 5. Return results (already RLS-filtered)
    res.json({ success: true, data: rows, pagination: { total: count } });
});
```

## Error Handling

```javascript
try {
    await studentRepo.deleteStudent(id, userContext);
} catch (err) {
    // User doesn't have permission to delete
    if (err.message.includes('INSUFFICIENT_PERMISSIONS')) {
        return sendError(res, { 
            status: 403, 
            body: { error: 'Access denied' } 
        });
    }
    
    // Student doesn't exist or user can't see it
    if (err.message.includes('NOT_FOUND')) {
        return sendError(res, { 
            status: 404, 
            body: { error: 'Not found' } 
        });
    }
    
    // Other error
    return sendError(res, err, 'Failed to delete');
}
```

## Setup Instructions

### 1. Install RLS Middleware (in server.js)

```javascript
const { initializeUserContext } = require('./middleware/rls');

// After authentication
app.use(authenticateToken);
app.use(initializeUserContext);  // Add this line
```

### 2. Import Repository Factory in Controllers

```javascript
const { RepositoryFactory } = require('../repositories');
const repos = new RepositoryFactory();
```

### 3. Replace Direct Model Access

Find all occurrences of:
- `Model.findAll()`
- `Model.findOne()`
- `Model.create()`
- `Model.update()`
- `Model.destroy()`

Replace with corresponding repository methods.

### 4. Pass userContext to Repository

```javascript
// Every repository call must include userContext
await repos.student.findVisibleStudents(userContext, filters, options);
```

## Verify RLS is Working

Test with different roles:

```bash
# As Admin (should see all students)
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:5000/api/students

# As Teacher (should see only own students)
curl -H "Authorization: Bearer $TEACHER_TOKEN" http://localhost:5000/api/students

# As Parent (should see only own children)
curl -H "Authorization: Bearer $PARENT_TOKEN" http://localhost:5000/api/students

# As Student (should see only own record)
curl -H "Authorization: Bearer $STUDENT_TOKEN" http://localhost:5000/api/students
```

Each should return only the data the role is allowed to see.

## Checklist for Controllers

- [ ] Imported RepositoryFactory
- [ ] Created repos instance
- [ ] Getting userContext from req.userContext || req.user
- [ ] Validating userContext.tenantId
- [ ] Using repos methods instead of direct model access
- [ ] Passing userContext to every repo call
- [ ] Removed manual RLS checks from controller
- [ ] Removed tenantId from filters (repo adds it)
- [ ] Removed role checks from queries (repo applies them)
- [ ] Test with multiple roles

## Logs to Monitor

Watch for these logs to verify RLS is working:

```
RLS_CONTEXT_INITIALIZED - User context prepared
RLS_DATA_ACCESS - Data access logged
RLS_VALIDATION_FAILED - Missing required context
USER_CONTEXT_REQUIRED - RLS enforcement attempted without context
TENANT_ISOLATION_FAILED - tenantId missing
```

## Common Mistakes

### Mistake 1: Forgetting userContext

```javascript
// ❌ WRONG - Missing userContext
const students = await studentRepo.findVisibleStudents(filters);

// ✅ CORRECT
const students = await studentRepo.findVisibleStudents(userContext, filters);
```

### Mistake 2: Including tenantId in filters

```javascript
// ❌ WRONG - Repository adds tenantId automatically
const filters = { tenantId: req.user.tenantId, classId };

// ✅ CORRECT
const filters = { classId };
```

### Mistake 3: Manual RLS checks

```javascript
// ❌ WRONG - Repository already does this
if (req.user.role === 'teacher') {
    query.teacherId = req.user.id;
}

// ✅ CORRECT - Just call repository
await studentRepo.findVisibleStudents(userContext, filters);
```

### Mistake 4: Mixing old and new approaches

```javascript
// ❌ WRONG - Using both service and repository
const students = await studentService.getStudents(tenantId);

// ✅ CORRECT - Use repository consistently
const { count, rows } = await studentRepo.findVisibleStudents(userContext);
```
