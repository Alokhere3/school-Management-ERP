# School ERP System Setup

## Quick Start

The system requires two setup steps to be fully operational:

### Step 1: Seed RBAC Roles and Permissions
```bash
node scripts/seedRBAC.js
```

This creates:
- ✅ 12 system roles (Super Admin, School Admin, Teacher, etc.)
- ✅ 100+ permission entries
- ✅ 343+ role-permission mappings

### Step 2: Create Super Admin User
```bash
node scripts/CreateAdminWithAlok.js
```

This creates the initial super admin user with default credentials:
- **Email:** `alokhere3@gmail.com`
- **Password:** `Alok@1234`

Override with environment variables:
```bash
SUPER_ADMIN_EMAIL=yourmail@example.com SUPER_ADMIN_PASSWORD=YourPassword123 node scripts/CreateAdminWithAlok.js
```

### Combined Setup
```bash
node scripts/seedRBAC.js && node scripts/CreateAdminWithAlok.js
```

## Creating a School Admin User

Once the Super Admin is set up:

1. **Login** with Super Admin credentials to get JWT token
2. **Call the registration endpoint** with your School Admin details:

```bash
POST /api/auth/register
Authorization: Bearer <super-admin-jwt-token>
Content-Type: application/json

{
  "name": "My School",
  "email": "school.admin@example.com",
  "password": "SecurePassword123!",
  "roles": ["School Admin"],
  "authenticated": true
}
```

## Role Hierarchy

### System Roles (Manage entire SaaS platform)
- **Super Admin** - Create tenants, manage School Admins
- **Support Engineer** - Cross-tenant support access

### Tenant Roles (Manage individual school/tenant)
- **School Admin** - Full control over one tenant
- **Principal** - Academic oversight
- **Teacher** - Class and attendance management
- **Accountant** - Finance and fees
- **HR Manager** - Payroll and staff
- **Librarian** - Library management
- **Transport Manager** - Transport operations
- **Hostel Warden** - Hostel management
- **Parent** - Limited child record access
- **Student** - Own records and LMS

## RBAC Architecture

The system uses a **Role-Based Access Control (RBAC)** model:

```
User → UserRole (enum: SUPER_ADMIN, SCHOOL_ADMIN, etc.)
    ↓
Role (matches enum to proper name: "Super Admin", "School Admin")
    ↓
RolePermission (maps roles to permissions)
    ↓
Permission (resource + action: "user_management:create")
```

### Permission Resolution

When a user requests an action:
1. System gets user's role enum (e.g., `SCHOOL_ADMIN`)
2. Converts to role name (e.g., `School Admin`)
3. Finds matching Role record
4. Queries RolePermission for that role
5. Returns highest permission level: `none`, `read`, `limited`, or `full`

## Troubleshooting

### Error: "Role(s) not found: School Admin"
**Cause:** RBAC seed hasn't been run yet
**Solution:** 
```bash
node scripts/seedRBAC.js
```

### Error: "You do not have permission to assign roles to users"
**Cause:** User doesn't have `user_management:create` permission
**Solution:** Ensure user has a role with full `user_management` access (Super Admin or School Admin)

### Error: "Only Super Admin can create users with School Admin role"
**Cause:** Only Super Admin users can create School Admin users
**Solution:** Use a Super Admin account for this operation

## Testing RBAC

Run the full test suite to verify RBAC is working:
```bash
npm test
```

All 68 tests should pass, including RBAC authorization tests.

## API Examples

### Register a School Tenant with Admin

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer <super-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC School",
    "email": "admin@abcschool.com",
    "password": "SecurePass123!",
    "roles": ["School Admin"]
  }'
```

### Login with Super Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alokhere3@gmail.com",
    "password": "Alok@1234"
  }'
```

Extract the `token` from response and use it for subsequent requests.
