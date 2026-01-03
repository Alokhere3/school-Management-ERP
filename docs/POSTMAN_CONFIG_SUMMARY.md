# Postman Configuration Update Summary

## What Was Updated

### 1. **Enhanced Environment File** (`postman_environment.json`)
Added comprehensive environment variables with descriptions:

```json
{
  "baseUrl": "http://localhost:3000",
  "token": "",                          // Active token (all requests use this)
  "superAdminEmail": "alokhere3@gmail.com",
  "superAdminPassword": "Alok@1234",
  "adminEmail": "admin@example.com",
  "adminPassword": "password123",
  "tenantId": "",                       // Auto-set by login
  "userId": "",                         // Auto-set by login
  "studentId": "",                      // Auto-set by requests
  "roleId": "",                         // Auto-set by requests
  "superAdminToken": "",                // Super Admin's JWT
  "adminToken": ""                      // School Admin's JWT
}
```

### 2. **Enhanced Collection** (`postman_collection.json`)

#### Auth Endpoints Updated:
- **🔐 Login (Super Admin)** 
  - Auto-extracts token from response body
  - Auto-extracts token from cookies
  - Saves to `{{superAdminToken}}` and `{{token}}`
  - Extracts tenantId and userId

- **🔓 Login (School Admin)**
  - Same token extraction as Super Admin
  - Saves to `{{adminToken}}` and `{{token}}`
  - For testing School Admin workflows

- **👤 Register (Create School Admin)**
  - Pre-request verification of Super Admin token
  - Creates new School Admin user
  - Helpful console messages

#### Automatic Features:
- ✅ Pre-request scripts to inject tokens
- ✅ Pre-request scripts to extract tokens from cookies
- ✅ Test scripts to auto-save tokens to environment
- ✅ Test scripts to extract and save tenant/user IDs
- ✅ Console logging for debugging

### 3. **New Documentation**

#### Quick Reference Guide
📄 `docs/POSTMAN_QUICK_REFERENCE.md`
- 3-step quick start
- Token management explained
- Common workflows
- Debugging checklist
- 5-minute read

#### Complete Setup Guide
📄 `docs/POSTMAN_SETUP_GUIDE.md`
- Detailed import instructions
- Token extraction script explanations
- Complete API endpoint summary
- Troubleshooting section
- Advanced customization tips

#### Visual Flow Diagram
📄 `docs/TOKEN_COOKIE_FLOW.md`
- ASCII diagrams of complete flows
- Multi-user token management
- Cookie persistence explained
- Error handling flows

## How Token Management Works Now

### Automatic Token Extraction
```
Login Request
    ↓
Server Response (contains token in body and/or cookies)
    ↓
Postman Test Script Runs:
├─ Extracts from: response.token (JSON body)
├─ Extracts from: cookies jar
└─ Saves to: {{token}}, {{superAdminToken}}, etc.
    ↓
Next Request Uses: Authorization: Bearer {{token}}
```

### Automatic Token Injection
```
Pre-Request Script Runs:
├─ Check if {{token}} is empty
├─ If yes: extract from cookies
└─ Inject into: Authorization header
    ↓
Request sent with token
```

### Cookie Support
- ✅ API returns token in response body? → Extracted automatically
- ✅ API sets token in cookies? → Extracted automatically
- ✅ Both work together seamlessly

## Usage Examples

### Example 1: Super Admin Workflow
```
1. Open Postman
2. Select environment: "School ERP Local" (dropdown, top-right)
3. Go to: Auth → 🔐 Login (Super Admin)
4. Click Send
5. Console shows: ✅ Token saved to environment
6. Token now in {{token}}, {{superAdminToken}}
7. Make requests to Admin-only endpoints
```

### Example 2: Create School Admin
```
1. Login as Super Admin (see Example 1)
2. Go to: Auth → 👤 Register (Create School Admin)
3. Update email/password in request
4. Click Send
5. School Admin created
6. Go to: Auth → 🔓 Login (School Admin)
7. Click Send
8. Now testing as School Admin with {{token}} = school admin token
```

### Example 3: Switch Users
```
Option A - Manual switch:
  1. Find {{superAdminToken}} in Environment
  2. Copy its value
  3. Paste into {{token}}
  4. All requests now use Super Admin token

Option B - Re-login:
  1. Run appropriate login request
  2. Token auto-updates in {{token}}
```

## Files Modified

```
docs/
├── postman_collection.json          ← Enhanced with token scripts
├── postman_environment.json         ← Added more variables
├── POSTMAN_SETUP_GUIDE.md          ← NEW: Complete guide
├── POSTMAN_QUICK_REFERENCE.md      ← NEW: Quick start
└── TOKEN_COOKIE_FLOW.md            ← NEW: Visual flows
```

## Key Features

### 🔐 Security
- JWT tokens extracted and stored securely
- Tokens in Authorization header (not URL)
- Cookie support for stateless auth
- Token variables cleared when needed

### 🔄 Multi-User Support
- Store multiple tokens: Super Admin, School Admin, Teacher, etc.
- Switch between users by updating `{{token}}`
- Each user's token preserved in separate variable

### 🤖 Automatic Management
- Zero manual token copying
- Auto-extraction from cookies
- Auto-injection into requests
- Console logs show status

### 📚 Well Documented
- Quick reference for common tasks
- Complete guide for advanced usage
- Visual diagrams explaining flows
- Troubleshooting section

## Getting Started

### 1. Import Files
```
Postman → Import → Select:
- docs/postman_collection.json
- docs/postman_environment.json
```

### 2. Select Environment
```
Top-right dropdown → "School ERP Local"
```

### 3. Login
```
Auth → 🔐 Login (Super Admin) → Send
Check console: ✅ Token saved to environment
```

### 4. Make Requests
```
All requests automatically use {{token}} in Authorization header
```

## Documentation Map

Start here based on your needs:

| Goal | File | Time |
|------|------|------|
| Get started quickly | POSTMAN_QUICK_REFERENCE.md | 5 min |
| Complete setup instructions | POSTMAN_SETUP_GUIDE.md | 15 min |
| Understand token flows | TOKEN_COOKIE_FLOW.md | 10 min |
| Postman best practices | POSTMAN_SETUP_GUIDE.md#Advanced | 10 min |

## No Manual Token Handling Needed

❌ Don't do this:
```
1. Login
2. Copy token from response manually
3. Paste into Authorization header
4. Update for every user switch
```

✅ Do this instead:
```
1. Login (token auto-saved)
2. Make requests (token auto-injected)
3. Switch users (token auto-updated)
```

## Backward Compatible

- ✅ Works with existing API
- ✅ Works with response body tokens
- ✅ Works with cookie-based tokens
- ✅ Works with both simultaneously
- ✅ No API changes required

## Next Steps

1. **Import the files** into Postman
2. **Read**: `POSTMAN_QUICK_REFERENCE.md` (5 minutes)
3. **Login** as Super Admin (automatically)
4. **Test** an endpoint
5. **Explore** other features as needed

---

**Questions?** See `docs/POSTMAN_SETUP_GUIDE.md` for detailed explanations and troubleshooting.
