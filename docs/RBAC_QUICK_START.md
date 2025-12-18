# RBAC Quick Start Guide

## Step 1: Run Migrations

Create the RBAC tables in your database:

```bash
# Using Sequelize migrations
npx sequelize-cli db:migrate

# Or manually run migration
node migrations/004_create_rbac_tables.js
```

Expected tables:
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`

## Step 2: Seed Initial Data

Populate all 11 roles, 20 modules, and their permissions:

```bash
node scripts/seedRBAC.js
```

This creates:
- 11 system roles (Super Admin, School Admin, Principal, Teacher, etc.)
- 20 resource modules (students, fees, attendance, etc.)
- 100 permission mappings

## Step 3: Assign Roles to Existing Users

For each user, assign them roles:

```javascript
// Example: Make user "alice" a Teacher in school "tenant-123"
const UserRole = require('./models/UserRole');

const role = await Role.findOne({ where: { name: 'Teacher' } });

await UserRole.create({
    userId: aliceId,
    roleId: role.id,
    tenantId: tenantId
});
```

Or use a migration script:

```bash
node scripts/assignRolesToUsers.js
```

## Step 4: Protect Routes

Update your route files to use the `authorize` middleware:

```javascript
const { authorize } = require('../middleware/rbac');

// Before (no protection):
router.get('/', studentController.listStudents);

// After (with RBAC):
router.get('/',
    authenticate,
    authorize('students', 'read'),
    studentController.listStudents
);
```

## Step 5: Test Permissions

```bash
npm test

# Or test manually:
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/students
```

---

## Role Reference

### Super Admin (System)
- Cross-tenant
- Full: Tenant management, analytics, technical ops
- Limited: User management
- Read-only: Most other modules

### School Admin
- Tenant-scoped
- Full: Everything except limited tech ops
- Limited: Tenant management, technical ops

### Principal
- Tenant-scoped
- Full: Students, admissions, attendance, timetable, exams, communication, analytics
- Limited: User management
- Read-only: Config, fees, transport, library, hostel, HR, inventory

### Teacher
- Tenant-scoped
- Full: Attendance (students), LMS
- Limited: Students, exams, communication, analytics
- Read-only: Config, fees, HR, library, transport, hostel

### Student
- Tenant-scoped
- Full: LMS
- Limited: Own student record, admissions, fees, attendance, communication
- Read-only: Timetable, exams, transport, library, hostel, analytics

### Parent
- Tenant-scoped
- Limited: Child student record, admissions, fees, attendance, communication, transport, library, hostel
- Read-only: Timetable, exams, analytics

---

## Permission Matrix Format

| Permission Level | Actions Allowed |
|---|---|
| `none` | ❌ No access |
| `read` | ✅ Read-only |
| `limited` | ✅ Read + own-scope write (teacher sees own students) |
| `full` | ✅ Create, read, update, delete, export |

---

## Applying to Existing Routes

### ✅ Before: No Authorization
```javascript
router.get('/', studentController.listStudents);
```

### ✅ After: With RBAC
```javascript
router.get('/',
    authenticate,
    authorize('students', 'read'),
    studentController.listStudents
);
```

### Controller Handles Row-Level Security
```javascript
exports.listStudents = async (req, res) => {
    const { level } = req.permission; // From middleware
    
    let where = { tenantId: req.user.tenantId };
    
    if (level === 'limited') {
        where.teacherId = req.user.id; // Teacher sees own students
    }
    
    const students = await Student.findAll({ where });
    res.json(students);
};
```

---

## File Structure

```
school-erp/
├── models/
│   ├── Role.js              (NEW)
│   ├── Permission.js         (NEW)
│   ├── RolePermission.js      (NEW)
│   ├── UserRole.js            (NEW)
│   ├── User.js (updated)     (UPDATED)
│   └── index.js (updated)    (UPDATED)
├── middleware/
│   └── rbac.js               (NEW)
├── migrations/
│   └── 004_create_rbac_tables.js (NEW)
├── scripts/
│   └── seedRBAC.js            (NEW)
├── routes/
│   ├── examples/
│   │   └── students-with-rbac.example.js (NEW)
│   └── (your existing routes)
└── docs/
    └── RBAC.md                (NEW)
```

---

## Checklist

- [ ] Run migration: `node migrations/004_create_rbac_tables.js`
- [ ] Seed data: `node scripts/seedRBAC.js`
- [ ] Assign roles to users
- [ ] Apply `authorize()` middleware to routes
- [ ] Update controllers for row-level filtering
- [ ] Run tests: `npm test`
- [ ] Deploy to staging
- [ ] Test with each role (Teacher, Admin, Parent, etc.)

---

## Troubleshooting

### "Role not found"
```
Check: Does role exist in database?
Run: SELECT * FROM roles;
Fix: Run seedRBAC.js again
```

### "Unauthorized"
```
Check: Is user assigned to role?
Query: SELECT * FROM user_roles WHERE userId = '...';
Fix: Assign role via UserRole.create()
```

### "Forbidden"
```
Check: Does role have permission?
Query: SELECT * FROM role_permissions 
       WHERE roleId = '...' AND level != 'none';
Fix: Check access matrix, run seedRBAC.js
```

---

## Next Steps

1. **Migrate**: `node migrations/004_create_rbac_tables.js`
2. **Seed**: `node scripts/seedRBAC.js`
3. **Update routes** with `authorize()` middleware
4. **Test** with different roles
5. **Deploy** to production

See [RBAC.md](./RBAC.md) for detailed documentation.
