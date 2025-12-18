# Role-Based Access Control (RBAC) Implementation Guide

## Overview

This implementation provides enterprise-grade role-based access control with tenant scoping. Every API call is evaluated as **role + tenant + module + action**.

### Key Principles

- **Tenant Isolation**: Users can only access resources within their assigned tenant (school)
- **Multiple Roles**: A user can have multiple roles within a tenant (e.g., Teacher + Department Head)
- **Granular Permissions**: Permissions are resource-action pairs (e.g., students:read, fees:create)
- **Four Access Levels**: `none`, `read`, `limited`, `full`
- **Cross-Tenant Roles**: System roles (Super Admin, Support Engineer) can access any tenant

---

## Data Models

### Roles Table
Defines roles like "Teacher", "Principal", "School Admin", etc.

```
roles
├── id (UUID, PK)
├── tenantId (UUID, FK to tenants) - NULL for system roles
├── name (string) - "Teacher", "School Admin", etc.
├── description (text)
├── isSystemRole (boolean) - true = Super Admin, Support Engineer
└── timestamps
```

### Permissions Table
Defines what actions can be performed on resources.

```
permissions
├── id (UUID, PK)
├── resource (string) - "students", "fees", "attendance", etc.
├── action (enum) - "create", "read", "update", "delete", "export"
├── description (text)
└── timestamps
```

### RolePermission Table
Maps roles to permissions with access levels.

```
role_permissions
├── id (UUID, PK)
├── roleId (UUID, FK to roles)
├── permissionId (UUID, FK to permissions)
├── level (enum) - "none", "read", "limited", "full"
└── timestamps
```

### UserRole Table
Maps users to roles within a specific tenant.

```
user_roles
├── id (UUID, PK)
├── userId (UUID, FK to users)
├── roleId (UUID, FK to roles)
├── tenantId (UUID, FK to tenants) - User role is tenant-scoped
└── timestamps
```

---

## Access Levels

### `none`
No access to the resource.

### `read`
Read-only access. Can view data but cannot modify.

### `limited`
Constrained access based on scope (row-level security).
- Teachers see only their students, classes, attendance
- Accountants see only their school's fees
- Parents see only their children's records

### `full`
Complete access including create, read, update, delete, and export.

---

## 11 Roles & Permissions Matrix

| Role | Tenant Mgmt | School Config | User Mgmt | Students | Fees | Attendance | HR | LMS | Analytics | Tech Ops |
|------|-------------|---------------|-----------|----------|------|-----------|-----|-----|-----------|----------|
| **Super Admin** | Full | Full | Limited | Read | Read | Read | Read | Read | Full | Full |
| **School Admin** | Limited | Full | Full | Full | Full | Full | Full | Full | Full | Limited |
| **Principal** | None | Read | Limited | Full | Read | Full | Read | Read | Full | None |
| **Teacher** | None | Read | None | Limited | Read | Full | Read | Full | Limited | None |
| **Accountant** | Read | Read | None | Read | Full | Read | Full | None | Full | None |
| **HR Manager** | None | Read | Limited | None | Read | Full | Full | None | Limited | None |
| **Librarian** | None | Read | None | Limited | Read | None | None | Read | Limited | None |
| **Transport Manager** | None | Read | None | Limited | Read | Limited | None | None | Limited | None |
| **Hostel Warden** | None | Read | None | Limited | Read | Limited | None | None | Limited | None |
| **Parent** | None | None | None | Limited | Limited | Limited | None | Read | Limited | None |
| **Student** | None | None | None | Limited | Limited | Limited | None | Full | Limited | None |
| **Support Engineer** (SaaS) | Full | Read | Read | Read | Read | Read | Read | Read | Full | Full |

---

## How to Use

### 1. Setup: Run Migrations

```bash
# Create RBAC tables
node migrations/004_create_rbac_tables.js up

# Or using Sequelize CLI (if available)
npx sequelize-cli db:migrate
```

### 2. Seed Data

```bash
# Populate all roles, permissions, and mappings
node scripts/seedRBAC.js
```

### 3. Assign Roles to Users

```javascript
// Assign "Teacher" role to user in tenant
const UserRole = require('./models/UserRole');

await UserRole.create({
    userId: 'user-uuid',
    roleId: 'teacher-role-id',
    tenantId: 'tenant-uuid'
});
```

### 4. Protect Routes with Authorization Middleware

```javascript
// routes/students.js
const { authorize } = require('../middleware/rbac');

// Only users with "read" or higher on "students" can list
router.get('/', 
    authorize('students', 'read'),
    studentController.listStudents
);

// Only "full" access can create
router.post('/', 
    authorize('students', 'create'),
    studentController.createStudent
);

// Update requires full access
router.put('/:id',
    authorize('students', 'update'),
    studentController.updateStudent
);

// Delete requires full access
router.delete('/:id',
    authorize('students', 'delete'),
    studentController.deleteStudent
);
```

### 5. Row-Level Security (RLS) in Controllers

Teachers should only see their own students:

```javascript
// controllers/studentController.js
const { checkPermission } = require('../middleware/rbac');

exports.listStudents = async (req, res) => {
    try {
        const permLevel = await checkPermission(
            req.user,
            'students',
            'read'
        );

        let query = { tenantId: req.user.tenantId };

        // If limited access, filter by teacher
        if (permLevel === 'limited') {
            query.teacherId = req.user.id;
        }

        const students = await Student.findAll({
            where: query
        });

        res.json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
```

---

## Permission Levels & Actions

When a user has a permission level, they can perform:

| Level | create | read | update | delete | export |
|-------|--------|------|--------|--------|--------|
| **none** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **read** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **limited** | ✅* | ✅ | ✅* | ✅* | ❌ |
| **full** | ✅ | ✅ | ✅ | ✅ | ✅ |

*with row-level constraints (own scope)

---

## Tenant Isolation

Every query must include tenant scoping:

```javascript
// ✅ CORRECT: Tenant-scoped query
const students = await Student.findAll({
    where: {
        tenantId: req.user.tenantId  // ← Required
    }
});

// ❌ WRONG: No tenant check
const students = await Student.findAll();
```

---

## System Roles (Cross-Tenant)

Super Admin and Support Engineer roles have `isSystemRole = true` and `tenantId = null`.

They can access any tenant but still need explicit permission checks:

```javascript
// Protect cross-tenant routes
router.get('/internal/tenants',
    authenticate,
    authorize('tenant_management', 'read'), // Super Admin only
    tenantController.listAllTenants
);
```

---

## Checking Permissions in Code

### In Middleware (During Request)
```javascript
router.get('/analytics',
    authorize('analytics', 'read'),
    analyticsController.getReports
);
```

### Conditionally in Controllers
```javascript
const { checkPermission } = require('../middleware/rbac');

const permission = await checkPermission(
    req.user,
    'fees',
    'export'
);

if (permission !== 'full') {
    // Don't allow export
}
```

---

## Security Best Practices

### 1. Always Enforce Tenant Isolation
```javascript
// Every query should filter by tenant
where: { tenantId: req.user.tenantId }
```

### 2. Verify Row Ownership for Limited Access
```javascript
// Teacher trying to update a student
const student = await Student.findByPk(studentId);

if (permLevel === 'limited' && student.teacherId !== req.user.id) {
    return res.status(403).json({ message: 'Not your student' });
}
```

### 3. Log Permission Denials
```javascript
// middleware/rbac.js
if (maxLevel === 'none') {
    console.warn(
        `Permission denied: User ${userId} tried ${action} on ${resource}`
    );
    return res.status(403).json({ message: 'Forbidden' });
}
```

### 4. Restrict Cross-Tenant Operations
```javascript
// Only Super Admin and Support Engineer should access /internal routes
router.get('/internal/*',
    authenticate,
    (req, res, next) => {
        if (!req.user.isSystemRole) {
            return res.status(403).json({ message: 'System access only' });
        }
        next();
    }
);
```

### 5. IP Allowlist for Support Access
```javascript
// scripts/seedRBAC.js or config
const SUPPORT_IPS = ['10.0.0.1', '10.0.0.2'];

if (!SUPPORT_IPS.includes(req.ip)) {
    return res.status(403).json({ message: 'IP not allowed' });
}
```

---

## Common Use Cases

### Case 1: Teacher Lists Own Students
```javascript
// Middleware checks: role=Teacher, action=read, resource=students
// Permission level: limited
// Controller applies: WHERE teacherId = userId AND tenantId = tenantId
```

### Case 2: Principal Lists All Students
```javascript
// Middleware checks: role=Principal, action=read, resource=students
// Permission level: full
// Controller applies: WHERE tenantId = tenantId (no teacher filter)
```

### Case 3: Finance Manager Exports Fees Report
```javascript
// Middleware checks: role=Accountant, action=export, resource=fees
// Permission level: full
// Controller generates Excel, streams to client
```

### Case 4: Parent Views Child Attendance
```javascript
// Middleware checks: role=Parent, action=read, resource=attendance_students
// Permission level: limited
// Controller applies: WHERE studentId IN (parentOwnedStudents)
```

---

## Testing RBAC

```javascript
// test/rbac.test.js
describe('RBAC', () => {
    it('should deny teacher access to fees', async () => {
        const teacher = await User.create({ ... });
        const teacherRole = await Role.findOne({ where: { name: 'Teacher' } });
        await UserRole.create({
            userId: teacher.id,
            roleId: teacherRole.id,
            tenantId: tenant.id
        });

        const res = await request(app)
            .post('/api/fees')
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({ ... });

        expect(res.status).toBe(403);
    });

    it('should allow accountant to create fees', async () => {
        // Similar test for Accountant role
        expect(res.status).toBe(201);
    });
});
```

---

## Migration & Rollback

```bash
# Apply migration
node migrations/004_create_rbac_tables.js up

# Rollback
node migrations/004_create_rbac_tables.js down
```

---

## Summary

- **Models**: Role, Permission, RolePermission, UserRole
- **Middleware**: `authorize(resource, action)` for route protection
- **Helper**: `checkPermission(user, resource, action)` for conditional checks
- **Levels**: none, read, limited, full
- **Tenant Scope**: Every query must include `tenantId = req.user.tenantId`
- **Row Level**: Limited roles need additional ownership checks in controllers

This architecture scales to support any number of modules, roles, and schools while maintaining security through tenant isolation and granular permissions.
