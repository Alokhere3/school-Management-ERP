# Postman Configuration Guide - School ERP API

## Overview

This guide explains how to use the updated Postman collection and environment for the School ERP API, including token management and cookie handling.

## Setup Instructions

### 1. Import Files into Postman

1. Open Postman
2. Click **Import** (top-left)
3. Select **Upload Files**
4. Import both files:
   - `docs/postman_collection.json` - API requests collection
   - `docs/postman_environment.json` - Environment variables

### 2. Set Up Environment

After importing:

1. Click the **gear icon** (⚙️) → **Manage Environments**
2. Select **School ERP Local** environment
3. Update the following variables if needed:
   - `baseUrl` - Should be `http://localhost:3000`
   - `superAdminEmail` - Default: `alokhere3@gmail.com`
   - `superAdminPassword` - Default: `Alok@1234`
   - `adminEmail` - Create your own (e.g., `admin@myschool.com`)
   - `adminPassword` - Create your own secure password

4. Click **Save**

## Token Management Workflow

### Option 1: Using Token Variables (Recommended)

The collection automatically extracts tokens from login responses and stores them in environment variables:

```
login response → token extracted → stored in environment variable {{token}}
                                 → stored in {{superAdminToken}} or {{adminToken}}
                                 → used in Authorization header: Bearer {{token}}
```

### Option 2: Using Cookies

If your API sets JWT tokens in HTTP cookies:

```
login response → token set in cookies → pre-request script reads cookies
                                      → extracted to {{token}} variable
                                      → used in Authorization header
```

The collection includes pre-request scripts that automatically:
1. Check if `{{token}}` environment variable is set
2. If empty, extract token from cookies
3. Use whichever source has the token

## Complete Workflow Example

### Step 1: Login as Super Admin

**Request:** `Auth → 🔐 Login (Super Admin)`

```json
POST /api/auth/login
{
  "email": "alokhere3@gmail.com",
  "password": "Alok@1234"
}
```

**What happens:**
- ✅ Response token extracted → `{{superAdminToken}}` variable
- ✅ Token also set to `{{token}}` (used by default in requests)
- ✅ Token extracted from cookies (if present)
- ✅ TenantId saved (if in response)

### Step 2: Create School Admin User

**Request:** `Auth → 👤 Register (Create School Admin)`

**Prerequisites:**
- Must be logged in as Super Admin (Step 1 completed)
- Uses `{{superAdminToken}}` in Authorization header

```json
POST /api/auth/register
Authorization: Bearer {{superAdminToken}}
{
  "name": "My School",
  "email": "admin@myschool.com",
  "password": "SecurePassword123!",
  "roles": ["School Admin"]
}
```

**What happens:**
- ✅ Pre-request script verifies Super Admin token exists
- ✅ User created successfully
- ✅ Response message: "Now run 'Login (School Admin)' to get admin token"

### Step 3: Login as School Admin

**Request:** `Auth → 🔓 Login (School Admin)`

```json
POST /api/auth/login
{
  "email": "admin@myschool.com",
  "password": "SecurePassword123!"
}
```

**What happens:**
- ✅ Response token extracted → `{{adminToken}}` variable
- ✅ Token also set to `{{token}}` (active token for further requests)
- ✅ TenantId saved to `{{tenantId}}`

### Step 4: Use Admin Token for Further Requests

All subsequent requests automatically use `{{token}}` in the Authorization header:

```json
GET /api/students
Authorization: Bearer {{token}}
```

## Token Extraction Scripts

### Response Test Script (Extracts token from response)

```javascript
const res = pm.response.json();

// Extract from response body
if (res && res.token) {
  pm.environment.set('token', res.token);
  pm.environment.set('superAdminToken', res.token);
  console.log('✅ Token saved from response body');
}

// Extract from cookies
const cookies = pm.cookies.jar().toJSON().cookies;
const tokenCookie = cookies.find(c => c.name === 'token' || c.name === 'jwt');
if (tokenCookie) {
  pm.environment.set('token', tokenCookie.value);
  console.log('✅ Token saved from cookies');
}
```

### Pre-Request Script (Uses token from cookies if needed)

```javascript
// Extract token from cookies if environment token is empty
const envToken = pm.environment.get('token');
if (!envToken || envToken === '') {
  const cookies = pm.cookies.jar().toJSON().cookies;
  const tokenCookie = cookies.find(c => c.name === 'token' || c.name === 'jwt');
  if (tokenCookie) {
    pm.environment.set('token', tokenCookie.value);
    console.log('✅ Token loaded from cookies');
  }
}
```

## Environment Variables Reference

| Variable | Purpose | Auto-Set | Example |
|----------|---------|----------|---------|
| `baseUrl` | API base URL | No | `http://localhost:3000` |
| `token` | Current JWT token (active) | Yes | JWT string |
| `superAdminToken` | Super Admin JWT | Yes | JWT string |
| `adminToken` | School Admin JWT | Yes | JWT string |
| `superAdminEmail` | Super Admin login email | No | `alokhere3@gmail.com` |
| `superAdminPassword` | Super Admin password | No | `Alok@1234` |
| `adminEmail` | School Admin email | No | `admin@myschool.com` |
| `adminPassword` | School Admin password | No | `SecurePassword123!` |
| `tenantId` | Current tenant ID | Yes | UUID |
| `userId` | Current user ID | Yes | UUID |
| `studentId` | Current student ID | Yes | UUID |
| `roleId` | Current role ID | Yes | UUID |

## Cookie Support

The API can return JWT tokens in:
1. **Response Body** - `{ "token": "jwt_string" }`
2. **HTTP Cookies** - `Set-Cookie: token=jwt_string`

The Postman collection handles both:
- ✅ Reads from response body JSON
- ✅ Extracts from HTTP cookies
- ✅ Stores in environment variables
- ✅ Uses in Authorization headers

## Common Tasks

### Task: Switch between Super Admin and School Admin

1. Run `Auth → 🔐 Login (Super Admin)` 
   - `{{token}}` = Super Admin token
   - `{{superAdminToken}}` = Super Admin token

2. Switch to School Admin:
   ```
   Manually set {{token}} = {{adminToken}} in environment
   ```
   OR
   
   Run `Auth → 🔓 Login (School Admin)`
   - `{{token}}` = School Admin token (auto-updated)
   - `{{adminToken}}` = School Admin token

### Task: Check Current Token Status

Open the **Environment** panel:
1. Click **Environment quick look** (eye icon at top)
2. View current values of:
   - `{{token}}` - Currently active
   - `{{superAdminToken}}` - Super Admin's token
   - `{{adminToken}}` - School Admin's token

### Task: Clear Tokens (Logout)

In Postman Environment:
1. Set `{{token}}` = (empty)
2. Set `{{superAdminToken}}` = (empty)
3. Set `{{adminToken}}` = (empty)

## Troubleshooting

### Issue: "Unauthorized" 401 response

**Possible causes:**
1. No token in `{{token}}` variable
2. Token expired
3. Wrong token for the role (using Super Admin token for School Admin endpoint)

**Solutions:**
- Run the appropriate login request again
- Check if token is in cookies: Open browser DevTools → Application → Cookies
- Verify correct token variable is being used

### Issue: "Forbidden" 403 response

**Possible causes:**
1. User doesn't have permission for that action
2. Trying to create School Admin without Super Admin role

**Solutions:**
- Verify you're using the correct role (Super Admin for sensitive operations)
- Check the endpoint requires fewer permissions
- Review RBAC documentation

### Issue: Token not being extracted from cookies

**Solution:**
1. Verify API is setting cookies: Open browser DevTools → Network → Response Headers
2. Look for: `Set-Cookie: token=...`
3. If not present, token will be in response body instead
4. Both mechanisms are supported in the collection

### Issue: "Pre-request Script Error"

**Solution:**
1. Check console logs: View → Show Postman Console
2. Verify environment is selected (top-right dropdown)
3. Re-import collection if scripts are corrupted

## Advanced: Custom Pre-Request Script

Add this to any request to manually manage tokens:

```javascript
// Pre-request script to set token from different sources
(function() {
  const token = pm.environment.get('token');
  
  if (!token) {
    // Try to get from cookies
    const cookies = pm.cookies.jar().toJSON().cookies;
    const tokenCookie = cookies.find(c => c.name === 'token');
    
    if (tokenCookie) {
      pm.environment.set('token', tokenCookie.value);
      pm.request.headers.add({
        key: 'Authorization',
        value: 'Bearer ' + tokenCookie.value
      });
    }
  }
})();
```

## API Endpoints Summary

### Authentication
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/register` - Create new user (requires auth)
- `POST /api/auth/logout` - Logout (clears cookies)

### Tenants
- `POST /api/tenants` - Create tenant
- `GET /api/tenants` - List tenants
- `GET /api/tenants/:id` - Get tenant details

### Students
- `POST /api/students` - Create student
- `GET /api/students` - List students
- `GET /api/students/:id` - Get student details
- `PATCH /api/students/:id/onboarding` - Update onboarding

All endpoints require:
```
Header: Authorization: Bearer {{token}}
```

## Additional Resources

- [RBAC Documentation](RBAC.md)
- [API Documentation](API.md)
- [Setup Instructions](../SETUP_INSTRUCTIONS.md)
