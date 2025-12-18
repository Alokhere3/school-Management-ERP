# RBAC Implementation Checklist

This checklist helps you implement role-based access control across your entire ERP system.

---

## Phase 1: Database Setup

- [x] Create RBAC models:
  - [x] `models/Role.js` - Role definitions
  - [x] `models/Permission.js` - Action-resource pairs
  - [x] `models/RolePermission.js` - Role-permission mappings
  - [x] `models/UserRole.js` - User-role assignments
- [x] Create migration: `migrations/004_create_rbac_tables.js`
- [x] Update `models/User.js` with role associations
- [x] Update `models/index.js` with all associations
- [x] Run migration: `node migrations/004_create_rbac_tables.js`
- [x] Seed initial data: `node scripts/seedRBAC.js`

---

## Phase 2: Middleware & Helpers

- [x] Create RBAC middleware: `middleware/rbac.js`
  - [x] `authorize(resource, action)` function
  - [x] `checkPermission(user, resource, action)` helper
- [x] Register middleware in `server.js` (if needed)

---

## Phase 3: Route Protection (Per Module)

For each module, add authorization middleware to routes:

### Auth Routes
- [ ] `POST /api/auth/login` - No auth required
- [ ] `POST /api/auth/logout` - Auth only
- [ ] `POST /api/auth/refresh` - Auth only

### Student Routes
- [ ] `GET /api/students` - authorize('students', 'read')
- [ ] `POST /api/students` - authorize('students', 'create')
- [ ] `PUT /api/students/:id` - authorize('students', 'update')
- [ ] `DELETE /api/students/:id` - authorize('students', 'delete')
- [ ] `GET /api/students/export` - authorize('students', 'export')

### Fees Routes
- [ ] `GET /api/fees` - authorize('fees', 'read')
- [ ] `POST /api/fees` - authorize('fees', 'create')
- [ ] `PUT /api/fees/:id` - authorize('fees', 'update')
- [ ] `DELETE /api/fees/:id` - authorize('fees', 'delete')
- [ ] `GET /api/fees/export` - authorize('fees', 'export')

### Attendance Routes
- [ ] `GET /api/attendance` - authorize('attendance_students', 'read')
- [ ] `POST /api/attendance` - authorize('attendance_students', 'create')
- [ ] `PUT /api/attendance/:id` - authorize('attendance_students', 'update')
- [ ] `DELETE /api/attendance/:id` - authorize('attendance_students', 'delete')

### Exams Routes
- [ ] `GET /api/exams` - authorize('exams', 'read')
- [ ] `POST /api/exams` - authorize('exams', 'create')
- [ ] `PUT /api/exams/:id` - authorize('exams', 'update')
- [ ] `DELETE /api/exams/:id` - authorize('exams', 'delete')

### User Management Routes
- [ ] `GET /api/users` - authorize('user_management', 'read')
- [ ] `POST /api/users` - authorize('user_management', 'create')
- [ ] `PUT /api/users/:id` - authorize('user_management', 'update')
- [ ] `DELETE /api/users/:id` - authorize('user_management', 'delete')

### Additional Modules
- [ ] Communication routes - authorize('communication', 'read')
- [ ] Timetable routes - authorize('timetable', 'read')
- [ ] Admissions routes - authorize('admissions', 'read')
- [ ] HR & Payroll routes - authorize('hr_payroll', 'read')
- [ ] Analytics routes - authorize('analytics', 'read')
- [ ] Library routes - authorize('library', 'read')
- [ ] Transport routes - authorize('transport', 'read')
- [ ] Hostel routes - authorize('hostel', 'read')
- [ ] Inventory routes - authorize('inventory', 'read')
- [ ] LMS routes - authorize('lms', 'read')

---

## Phase 4: Row-Level Security (RLS) in Controllers

For each resource, implement row-level filtering for "limited" access:

### Teachers (limited access to students)
```javascript
// In studentController.listStudents()
if (req.permission.level === 'limited') {
    query.where.teacherId = req.user.id;
}
```

### Parents (limited to own child)
```javascript
// In studentController.getStudentById()
if (req.permission.level === 'limited') {
    const parent = await Parent.findOne({ where: { userId: req.user.id } });
    const children = await parent.getChildren();
    if (!children.map(c => c.id).includes(studentId)) {
        return res.status(403).json({ message: 'Not your child' });
    }
}
```

### Students (limited to own record)
```javascript
// In studentController.getStudentById()
if (req.permission.level === 'limited' && studentId !== req.user.studentId) {
    return res.status(403).json({ message: 'Cannot view other students' });
}
```

### Accountants (limited to own school)
```javascript
// In feesController.listFees()
const fees = await StudentFee.findAll({
    where: { tenantId: req.user.tenantId }
});
```

---

## Phase 5: Assign Roles to Users

- [x] Create role assignment script: `scripts/assignRolesToUsers.js`
- [ ] Run script: `node scripts/assignRolesToUsers.js`
- [ ] Verify users have roles: Check `user_roles` table
- [ ] Test login as different roles

---

## Phase 6: Testing

- [x] Ensure existing tests still pass (34/34)
- [ ] Add RBAC-specific tests:
  - [ ] Teacher cannot delete student
  - [ ] Parent can only see own child
  - [ ] School Admin can see all students
  - [ ] Super Admin can access cross-tenant
  - [ ] Accountant cannot modify attendance
  - [ ] HR Manager has full hr_payroll access

### Test Example:
```javascript
describe('RBAC', () => {
    it('should deny teacher access to delete student', async () => {
        // Login as teacher
        // POST /api/students/123 with DELETE method
        // Expect 403 Forbidden
    });

    it('should allow school admin to delete student', async () => {
        // Login as school admin
        // Same request
        // Expect 200 OK
    });
});
```

- [ ] Run full test suite: `npm test`

---

## Phase 7: Documentation & Training

- [x] Create main documentation: `docs/RBAC.md`
- [x] Create quick start guide: `docs/RBAC_QUICK_START.md`
- [ ] Create per-role user guides (for each role type)
- [ ] Document how to add new roles
- [ ] Document how to modify permissions
- [ ] Create troubleshooting guide

---

## Phase 8: Deployment

- [ ] Deploy models to staging
- [ ] Deploy middleware to staging
- [ ] Run migrations on staging: `node migrations/004_create_rbac_tables.js`
- [ ] Seed RBAC data on staging: `node scripts/seedRBAC.js`
- [ ] Assign roles to staging users
- [ ] Test with each role type on staging
- [ ] Get sign-off from stakeholders
- [ ] Deploy to production
- [ ] Run migrations on production
- [ ] Seed RBAC data on production
- [ ] Assign roles to production users
- [ ] Monitor logs for permission errors
- [ ] Document any issues found

---

## Phase 9: Post-Deployment

- [ ] Monitor permission denial logs
- [ ] Adjust permissions based on feedback
- [ ] Train staff on new permission system
- [ ] Create role-specific onboarding docs
- [ ] Set up audit logging (who accessed what)
- [ ] Review and tune performance
- [ ] Plan future enhancements

---

## Roles to Implement

- [ ] **Super Admin** - Cross-tenant system admin
- [ ] **School Admin** - Full school control
- [ ] **Principal** - Academic + admin oversight
- [ ] **Teacher** - Class + student management
- [ ] **Student** - Own record + LMS
- [ ] **Parent** - Child record view
- [ ] **Accountant** - Finance management
- [ ] **HR Manager** - HR & payroll
- [ ] **Librarian** - Library management
- [ ] **Transport Manager** - Transport ops
- [ ] **Hostel Warden** - Hostel management
- [ ] **Support Engineer** - SaaS support

---

## Example: Protecting Student Routes

### Before (No Authorization)
```javascript
router.get('/', studentController.listStudents);
```

### After (With RBAC)
```javascript
const { authorize } = require('../middleware/rbac');

router.get('/',
    authenticate,
    authorize('students', 'read'),
    studentController.listStudents
);

router.post('/',
    authenticate,
    authorize('students', 'create'),
    studentController.createStudent
);

router.put('/:id',
    authenticate,
    authorize('students', 'update'),
    studentController.updateStudent
);

router.delete('/:id',
    authenticate,
    authorize('students', 'delete'),
    studentController.deleteStudent
);
```

### Controller Update for RLS
```javascript
exports.listStudents = async (req, res) => {
    const { level } = req.permission;
    
    let where = { tenantId: req.user.tenantId };
    
    // Row-level security
    if (level === 'limited') {
        where.teacherId = req.user.id;
    }
    
    const students = await Student.findAll({ where });
    res.json(students);
};
```

---

## Common Mistakes to Avoid

### ❌ Missing Tenant Isolation
```javascript
// WRONG: No tenant check
const students = await Student.findAll();

// CORRECT: Always filter by tenant
const students = await Student.findAll({
    where: { tenantId: req.user.tenantId }
});
```

### ❌ Not Checking Row Ownership for Limited Access
```javascript
// WRONG: Doesn't check if teacher owns student
const student = await Student.findByPk(studentId);

// CORRECT: Verify access
if (req.permission.level === 'limited') {
    if (student.teacherId !== req.user.id) {
        return res.status(403).json({ message: 'Not your student' });
    }
}
```

### ❌ Forgetting Authorization Middleware
```javascript
// WRONG: Route has no protection
router.post('/', studentController.createStudent);

// CORRECT: Use authorize middleware
router.post('/',
    authenticate,
    authorize('students', 'create'),
    studentController.createStudent
);
```

---

## Success Criteria

- [x] Models created and migrated
- [x] Middleware implemented
- [x] Seed script creates all roles & permissions
- [ ] All routes protected with authorize middleware
- [ ] Row-level security implemented in controllers
- [ ] Roles assigned to users
- [ ] Tests passing (34/34)
- [ ] Documentation complete
- [ ] Team trained on new system
- [ ] Deployed to production
- [ ] No permission errors in logs
- [ ] Users report correct access levels

---

## Next Steps

1. **Now**: Run migrations and seed data
2. **Week 1**: Protect all routes with authorization
3. **Week 2**: Implement RLS in controllers
4. **Week 3**: Assign roles and test
5. **Week 4**: Deploy to production

---

**Status**: ✅ Foundation Complete | ⏳ Route Protection In Progress
