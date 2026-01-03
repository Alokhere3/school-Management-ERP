# Test School Admin Registration

## Issue Fixed
**Error**: Role not found when registering with `"School Admin"` role  
**Root Cause**: Tenant-scoped roles (like "School Admin") are only created when the tenant is seeded, which happens AFTER the registration validation check.

## Solution Implemented
Modified the role validation in the registration endpoint to:
1. **Separate system roles from tenant-scoped roles** during validation
2. **Only validate system roles** against the database (these must exist globally)
3. **Validate tenant-scoped roles** against a known list (they will be created during tenant seeding)

## Code Changes
[routes/auth.js](routes/auth.js#L295-L335): Updated registration role validation logic

## Test Case: Register School Admin

### Request
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JDS Public School",
    "email": "schooladmin@gmail.com",
    "password": "Alok@1234",
    "roles": ["School Admin"]
  }'
```

### Expected Response (Success ✅)
```json
{
  "success": true,
  "message": "Tenant and admin user created successfully",
  "tenant": {
    "id": "uuid-here",
    "name": "JDS Public School",
    "slug": "jds-public-school",
    "createdAt": "2026-01-03T...",
    "updatedAt": "2026-01-03T..."
  },
  "user": {
    "id": "uuid-here",
    "email": "schooladmin@gmail.com",
    "tenantId": "uuid-here",
    "status": "active"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### What Happens Behind the Scenes
1. ✅ Validates `"School Admin"` is in the known tenant roles list
2. ✅ Creates the tenant `"JDS Public School"`
3. ✅ Seeds all default roles for the new tenant (including "School Admin")
4. ✅ Creates the admin user
5. ✅ Assigns "School Admin" role to the user
6. ✅ Returns JWT tokens for authentication

## Test Case: Register with Invalid Role

### Request
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test School",
    "email": "test@gmail.com",
    "password": "Test@1234",
    "roles": ["NonExistentRole"]
  }'
```

### Expected Response (Failure ❌)
```json
{
  "success": false,
  "error": "Unknown roles: NonExistentRole",
  "code": "INVALID_ROLES",
  "details": ["NonExistentRole"]
}
```

## Supported Tenant Roles
These roles are created automatically when a tenant is registered:
- `School Admin` - Full school management access
- `Teacher` - Teaching staff access
- `Staff` - Support staff access
- `Student` - Student access
- `Parent` - Parent/Guardian access
- `Accountant` - Financial management access
- `Librarian` - Library management access

## Supported System Roles
These roles are global and must exist in the database:
- `Super Admin` (custom system roles can be added via system admin panel)

## Troubleshooting

### If still getting "Role not found"
1. Check if "School Admin" is in the known tenant roles list
2. Verify `seedTenantRoles()` completes successfully (check logs)
3. Ensure the database migrations have run (roles table exists)

### If "School Admin" role exists but isn't assigned
1. Check the `UserRole` table to verify the assignment
2. Check the role assignment loop at lines 380-395
3. Verify the role enum mapping includes "School Admin" → "SCHOOL_ADMIN"
