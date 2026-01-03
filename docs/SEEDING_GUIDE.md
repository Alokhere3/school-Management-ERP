# Database Seeding & Initialization Guide

Complete guide for initializing the School ERP database with roles, permissions, and super admin user.

## Quick Start

### Option 1: Using NPM Script (Recommended)
```bash
npm run seed
```

### Option 2: Direct Node Execution
```bash
node scripts/seedDatabase.js
```

### Option 3: With Custom Credentials
```bash
SUPER_ADMIN_EMAIL=admin@myschool.com SUPER_ADMIN_PASSWORD=MySecure@Pass123 npm run seed
```

### Option 4: Production Environment
```bash
npm run seed:prod
```

---

## What Gets Created

### ✅ Permissions (100 total)
- **20 Modules**: tenant_management, school_config, user_management, students, admissions, fees, attendance_students, attendance_staff, timetable, exams, communication, transport, library, hostel, hr_payroll, inventory, lms, analytics, technical_ops, data_export
- **5 Actions per Module**: create, read, update, delete, export
- **Total**: 20 × 5 = 100 permissions

### ✅ System Roles (1)
| Role | Description | tenantId | isSystemRole |
|------|-------------|----------|-------------|
| Super Admin | System-wide super administrator with complete control | NULL | true |

**Super Admin Permissions**: Full access to all 100 permissions (create, read, update, delete, export on all modules)

### ✅ Default Tenant
- **Name**: System Tenant (Admin Portal)
- **Slug**: system
- **Purpose**: Default tenant for system administration

### ✅ Tenant-Level Roles (10)

| Role | Level | Key Access |
|------|-------|-----------|
| School Admin | Full | All school operations, limited tenant management |
| Principal | Read-Heavy | Students, exams, analytics, limited user management |
| Teacher | Limited | Attendance, exams, LMS, grades |
| Accountant | Module-Specific | Fees, payroll, analytics, reports |
| HR Manager | Module-Specific | Staff attendance, payroll, analytics |
| Librarian | Module-Specific | Library management, inventory |
| Transport Manager | Module-Specific | Transport, student tracking |
| Hostel Warden | Module-Specific | Hostel management, student tracking |
| Parent | Read-Only | Limited student info, fees, attendance, timetable |
| Student | Read-Heavy | Own records, LMS, timetable, exams |

### ✅ Super Admin User
- **Email**: `admin@schoolerp.com` (default, customizable)
- **Password**: `SuperAdmin@123` (default, customizable)
- **Status**: active
- **Role**: SUPER_ADMIN
- **Tenant**: system

---

## Default Credentials

### ⚠️ Important Security Note
**NEVER use these credentials in production!**

```
Email:    admin@schoolerp.com
Password: SuperAdmin@123
```

Change these immediately after first login.

---

## Customizing Super Admin Credentials

### Using Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/school_erp

# Super Admin Credentials
SUPER_ADMIN_EMAIL=your-email@yourdomain.com
SUPER_ADMIN_PASSWORD=YourSecure@Pass123
```

Then run:
```bash
npm run seed
```

### Command Line Override

```bash
SUPER_ADMIN_EMAIL=admin@district.edu SUPER_ADMIN_PASSWORD="SecurePass@2024" npm run seed
```

### Interactive Setup (Not Implemented Yet)

Future version will support interactive credential setup:
```bash
npm run seed -- --interactive
```

---

## Complete Initialization Workflow

### 1. Fresh Database Setup

```bash
# Step 1: Ensure database is created
# (Database should exist but tables will be created)

# Step 2: Run seed script
npm run seed

# Step 3: Verify seeding
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@schoolerp.com","password":"SuperAdmin@123"}'

# Expected response: Access token and refresh token
```

### 2. Register First School (Tenant)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Central School District",
    "email": "schooladmin@example.com",
    "password": "AdminPass@123",
    "roles": ["School Admin"]
  }'

# Response includes tenant, user, and tokens
```

### 3. Verify Setup

```bash
# Check system roles exist
SELECT * FROM roles WHERE is_system_role = true;
-- Should return: Super Admin

# Check system tenant exists
SELECT * FROM tenants WHERE slug = 'system';
-- Should return: System Tenant (Admin Portal)

# Check super admin user exists
SELECT * FROM users WHERE email = 'admin@schoolerp.com';
-- Should show active user with SUPER_ADMIN role

# Check all permissions exist
SELECT COUNT(DISTINCT resource) as modules, COUNT(DISTINCT action) as actions 
FROM permissions;
-- Should return: 20 modules, 5 actions (100 total permissions)
```

---

## File Structure

```
scripts/
├── seedDatabase.js          ← Main seed script
├── generate-swagger.js
└── serve-docs.js

models/
├── Role.js                  ← Role model (includes validation)
├── Permission.js            ← Permission model
├── RolePermission.js        ← Role-Permission mapping
└── User.js                  ← User model

services/
└── rolePermissionService.js ← Legacy service (can be deprecated)

routes/
└── auth.js                  ← Registration with improved role validation

.env                         ← Configuration (SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
package.json                 ← Scripts added: seed, seed:prod
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | config/database.js | Database connection string |
| `SUPER_ADMIN_EMAIL` | admin@schoolerp.com | Email for super admin user |
| `SUPER_ADMIN_PASSWORD` | SuperAdmin@123 | Password for super admin user |
| `NODE_ENV` | development | Node environment (development, production) |

---

## Troubleshooting

### Error: "Database connection failed"
**Solution**: Check DATABASE_URL and ensure PostgreSQL is running
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Error: "Table does not exist"
**Solution**: Models are auto-synced. Check if sequelize.sync() ran
```bash
# Force sync
node -e "require('./config/database').sequelize.sync({ force: true })"
```

### Error: "Duplicate entry for email"
**Solution**: Super admin user already exists. Use UPDATE instead or delete and re-seed
```bash
# Delete existing user
DELETE FROM users WHERE email = 'admin@schoolerp.com';

# Then re-run seed
npm run seed
```

### Error: "bcryptjs not installed"
**Solution**: Install missing dependency
```bash
npm install bcryptjs
```

### Seed Hangs (Timeout)
**Solution**: Check database logs and connection
```bash
# Increase timeout
timeout 60s npm run seed
```

---

## Performance Notes

- **Seed Time**: ~500-1000ms for first run (100 permissions + roles)
- **Idempotent**: Safe to run multiple times (uses findOrCreate)
- **No Data Loss**: Existing data is preserved
- **Production**: Use `npm run seed:prod` for production environment

---

## What Happens If You Re-Run Seed?

The seed script is **idempotent** - it safely handles re-execution:

✅ **Safe to Re-Run**:
- Permissions: Uses `findOrCreate` (no duplicates)
- System roles: Uses `findOrCreate` (no duplicates)
- Tenant roles: Uses `findOrCreate` per tenant (no duplicates)
- Super admin: If exists, password is updated; if not, created

⚠️ **Note**: If super admin user already exists, password will be reset to default value

---

## Security Checklist

- [ ] Change super admin password on first login
- [ ] Use environment variables for custom credentials
- [ ] Do not commit `.env` file to version control
- [ ] Use strong passwords (min 12 characters, mixed case, numbers, symbols)
- [ ] Restrict database access to localhost during development
- [ ] Enable SSL/TLS for production connections
- [ ] Set `SUPER_ADMIN_PASSWORD` via CI/CD secrets in production

---

## Manual Setup (If Preferred)

If you prefer manual setup instead of the seed script:

```sql
-- 1. Create permissions manually
-- See scripts/seedDatabase.js MODULES and ACTIONS arrays

-- 2. Create super admin role
INSERT INTO roles (id, name, description, is_system_role, tenant_id, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'Super Admin',
  'System-wide super administrator',
  true,
  NULL,
  NOW(),
  NOW()
);

-- 3. Create system tenant
INSERT INTO tenants (id, name, slug, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'System Tenant (Admin Portal)',
  'system',
  NOW(),
  NOW()
);

-- 4. Create super admin user (hash password with bcrypt)
INSERT INTO users (id, email, password_hash, tenant_id, status, must_change_password, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'admin@schoolerp.com',
  '$2a$14$...',  -- bcrypt hash of password
  (SELECT id FROM tenants WHERE slug = 'system'),
  'active',
  false,
  NOW(),
  NOW()
);

-- See rolePermissionService.js for detailed manual setup
```

---

## Next Steps After Seeding

1. **Start Server**:
   ```bash
   npm run dev
   ```

2. **Login as Super Admin**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@schoolerp.com","password":"SuperAdmin@123"}'
   ```

3. **Register First School**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My School",
       "email": "admin@myschool.com",
       "password": "SecurePass@123",
       "roles": ["School Admin"]
     }'
   ```

4. **Create Additional Tenant Roles** (via admin panel):
   - Assign Teacher, Principal, Parent, Student roles
   - Configure role-specific permissions

---

## Related Files

- [RBAC Implementation](RBAC.md)
- [Role Validation Security Fix](ROLE_VALIDATION_SECURITY_FIX.md)
- [Role Models](../models/Role.js)
- [Permission Models](../models/Permission.js)
- [Auth Routes](../routes/auth.js)
