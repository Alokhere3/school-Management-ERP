# Access Control, Authentication & Tenant Management (Reference)

This document consolidates the RBAC design, authentication/token flow, tenant management concepts, and the important database tables used by the School ERP backend. It is intended as a single-reference README for developers and operators.

---

## Contents
- Overview
- Authentication & Token/Cookie Flow
- Role-Based Access Control (RBAC) Flow
- Tenant Management
- Important Database Tables (schema + rows)
- Row-Level Security (RLS) rules & examples
- Common API examples & usage
- Migrations, seeding & troubleshooting

---

## Overview

This system is multi-tenant: each school (tenant) is isolated. Access control is enforced by a combination of authentication (JWT/cookie) and authorization (RBAC). Permissions are evaluated as: `role + tenantScope + resource + action`.

Key principles:
- Tenant isolation: every data query must include `tenantId` filtering.
- Users can have multiple roles within a tenant.
- Permissions are resource-action pairs with a `level` (`none`, `read`, `limited`, `full`).
- `limited` implies row-level constraints (e.g., teachers see their own students).

---

## Authentication & Token/Cookie Flow

1. Login endpoint (`POST /api/auth/login`) issues a JWT and may set an HTTP-only cookie. The response body often returns `token` and `tenantId`.
2. Clients include the token using the `Authorization: Bearer <token>` header or by relying on the cookie the server sets.
3. On each request the server middleware authenticates the token (verify signature, expiry) and loads `req.user` and `req.permission`.
4. If the token is invalid/expired → `401`. If user lacks permission → `403`.

Token sources priority (typical):
- Environment / explicit header value
- Cookie (if set)

Common Postman/process behaviors:
- Store tokens in environment variables like `token`, `superAdminToken` and reuse them in requests.
- Pre-request scripts extract cookies or response `token` and populate environment variables.

See: `docs/TOKEN_COOKIE_FLOW.md` for diagrams and Postman flow details.

---

## RBAC Flow (high level)

1. When a request arrives, `authenticate` middleware verifies the token and sets `req.user`.
2. `authorize(resource, action)` middleware checks whether the user (via their roles) has sufficient `level` to perform the requested action on the resource.
3. Middleware attaches permission info to `req.permission` (e.g., `{ resource: 'students', action: 'read', level: 'limited' }`).
4. Controller code must apply tenant scoping and row-level constraints based on the permission `level`.

Access levels:
- `none` — no access
- `read` — read-only
- `limited` — access with row-level restrictions (e.g., own students only)
- `full` — unrestricted create/update/delete/export

Typical usage in routes:

```js
router.get('/', authenticate, authorize('students', 'read'), studentController.listStudents);
router.post('/', authenticate, authorize('students', 'create'), studentController.createStudent);
```

Row-level filtering example (controller):

```js
function applyRowLevelSecurity(query, req) {
  if (req.permission && req.permission.level === 'limited') {
    if (req.user.role === 'teacher') query.teacherId = req.user.id;
    if (req.user.role === 'parent') query.parentOf = req.user.id;
    if (req.user.role === 'student') query.userId = req.user.id;
  }
  return query;
}
```

---

## Tenant Management

- `tenants` are top-level schools/organizations.
- Each tenant has separate data rows for tenant-scoped tables (students, classes, staff, fees, etc.).
- System roles (Super Admin, Support Engineer) have `isSystemRole = true` and `tenantId = null` and can access across tenants when authorized.
- Tenant-scoped operations must validate that the requesting user belongs to the tenant and that `tenantId` is present on the token.

Administration endpoints (example):
- `GET /internal/tenants` — system-level (Super Admin) operations
- Tenant-scoped endpoints live under `/api/*` and require `tenantId`.

---

## Important Database Tables (schema and row explanation)

Note: types shown are conceptual (UUID, string, enum, timestamps). Use migrations for exact definitions.

### `tenants`
- id (UUID, PK)
- name
- domain/slug
- status (`active`/`inactive`)
- createdAt, updatedAt

Rows: one row per school instance.

### `users`
- id (UUID, PK)
- tenantId (UUID) — optional for system accounts
- email
- passwordHash
- name
- role (deprecated single-role field; RBAC uses `user_roles`)
- isSystemUser (boolean)
- createdAt, updatedAt

Rows: each user account; system users may have `tenantId = NULL`.

### `roles`
- id (UUID, PK)
- tenantId (UUID) — NULL for system roles
- name (e.g., Teacher, Principal)
- description
- isSystemRole (boolean)
- createdAt, updatedAt

Rows: definition of role entities. A role may be system-wide (tenantId = NULL).

### `permissions`
- id (UUID, PK)
- resource (string, e.g., 'students', 'fees')
- action (string/enum, e.g., 'create', 'read', 'update', 'delete', 'export')
- description
- createdAt, updatedAt

Rows: each resource-action mapping the system recognizes.

### `role_permissions` (role_permissions)
- id (UUID, PK)
- roleId (UUID, FK -> roles.id)
- permissionId (UUID, FK -> permissions.id)
- level (enum: 'none', 'read', 'limited', 'full')
- createdAt, updatedAt

Rows: map a role to a permission with a specific access level.

### `user_roles`
- id (UUID, PK)
- userId (UUID, FK -> users.id)
- roleId (UUID, FK -> roles.id)
- tenantId (UUID) — role is scoped to a tenant
- createdAt, updatedAt

Rows: assign role(s) to users per tenant.

### `students` (example of tenant table)
- id (UUID, PK)
- tenantId (UUID, FK -> tenants.id)
- admissionNo
- firstName, lastName
- classId (UUID, FK -> classes.id)
- teacherId (UUID) — optional, to enforce teacher ownership
- photoKey / photoUrl
- onboardingData (JSON)
- status
- createdAt, updatedAt

Rows: one per student; queries must filter by `tenantId` and may apply teacher-level filters for `limited` access.

### `classes`
- id (UUID, PK)
- tenantId (UUID)
- className
- section
- status
- createdAt, updatedAt

Rows: one per class for a tenant.

(Additional tables: `staff`, `parents`, `attendance`, `fees`, `exams`, `role_permissions` etc. follow similar tenant-scoped layout.)

---

## Row-Level Security (RLS) — rules and examples

RLS is implemented at application-level (controller + service) rather than DB policy.

Common rules:
- If `req.permission.level === 'limited'` then scope queries to ownership fields (e.g., `teacherId`, `parentOf`, `userId`).
- Always combine RLS with tenant scoping: `where: { tenantId: ..., ...rlsFilters }`.

Example: GET `/api/students` with a teacher role (limited)
- Middleware sets `req.permission.level = 'limited'`.
- Controller builds `query = { tenantId: req.user.tenantId, teacherId: req.user.id }`.
- Service executes `Student.findAndCountAll({ where: query, limit, offset })`.

Edge cases:
- Parents who have multiple children: `where: { tenantId, id: { [Op.in]: parentStudentIds } }`.
- Admins with `full` access: only tenantId is required.

---

## API Examples

Create student (classId required):

```http
POST /api/students
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body (multipart): admissionNo, firstName, dateOfBirth, classId, photo
```

List students (optional class filter):

```
GET /api/students?page=1&limit=20&classId=<class-uuid>
```

Update student:

```
PUT /api/students/:id
Content-Type: multipart/form-data
Authorization: Bearer <token>
Body: any fields to update (including classId)
```

---

## Migrations, Seeding & Commands

Run RBAC migration:

```bash
npx sequelize-cli db:migrate
# or, if using provided migration helper
node migrations/004_create_rbac_tables.js up
```

Seed RBAC data:

```bash
node scripts/seedRBAC.js
```

Assign roles to a user programmatically:

```js
await UserRole.create({ userId, roleId, tenantId });
```

---

## Troubleshooting & Best Practices

- Always validate `tenantId` present on the token for tenant-scoped operations.
- Log permission denials with user id, resource, action, and tenant for audit.
- Keep `role_permissions` consistent with product access matrix; re-run `seedRBAC.js` when matrix changes.
- For debugging RLS, temporarily log the built `where` clause used for queries.

---

## References
- Detailed RBAC design: `docs/RBAC.md`
- Quick start: `docs/RBAC_QUICK_START.md`
- Token & cookie flow: `docs/TOKEN_COOKIE_FLOW.md`
- Security notes: `docs/SECURITY.md`
- Student API specifics: `docs/STAFF_API.md` and `docs/API.md`

---

(End of consolidated reference)
