# Postman Quick Reference - Token & Cookie Management

## 🚀 Quick Start (3 Steps)

### 1️⃣ Import Files
- Download: `docs/postman_collection.json` & `docs/postman_environment.json`
- Postman: Import → Upload Files → Select both
- Select Environment: Top-right dropdown → "School ERP Local"

### 2️⃣ Login as Super Admin
1. Go to: **Auth** → **🔐 Login (Super Admin)**
2. Click **Send**
3. ✅ Token automatically saved to `{{token}}` & `{{superAdminToken}}`

### 3️⃣ Create School Admin (Optional)
1. Go to: **Auth** → **👤 Register (Create School Admin)**
2. Update email/password in request body (Params tab)
3. Click **Send**
4. ✅ User created successfully
5. Then run: **Auth** → **🔓 Login (School Admin)**

---

## 📋 Token Management Explained

### How Tokens Are Saved

```
Login Request
    ↓
Response arrives (contains JWT token)
    ↓
Test Script runs:
├─ Extracts token from: response body JSON
├─ Extracts token from: HTTP cookies
├─ Saves to: {{token}} (active token)
├─ Saves to: {{superAdminToken}} or {{adminToken}} (role-specific)
└─ Logs: ✅ Token saved to environment
    ↓
Next Request uses: Authorization: Bearer {{token}}
```

### How Tokens Are Used

```
Pre-Request Script runs:
├─ Check if {{token}} is set
├─ If empty: extract from cookies
├─ If found: use it
└─ Continue to request
    ↓
Request sent with:
Authorization: Bearer {{token}}
    ↓
Response received
    ↓
Test Script saves any new tokens
```

### Cookie vs Response Body

**API returns token in response body:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "tenantId": "uuid-123"
}
```
✅ Automatically extracted and saved

**API returns token in cookies:**
```
Set-Cookie: token=eyJhbGc...; Path=/; HttpOnly
```
✅ Automatically extracted and saved

**Works with both** ✓

---

## 🔑 Available Tokens

| Name | Variable | Use Case |
|------|----------|----------|
| **Active Token** | `{{token}}` | Used in all API requests by default |
| **Super Admin Token** | `{{superAdminToken}}` | For operations requiring Super Admin |
| **School Admin Token** | `{{adminToken}}` | For operations requiring School Admin |

---

## 📝 Environment Variables

### Auto-Set by Login (✅ No manual setup needed)
- `{{token}}` - Current active token
- `{{superAdminToken}}` - Super Admin's token
- `{{adminToken}}` - School Admin's token
- `{{tenantId}}` - Current tenant ID
- `{{userId}}` - Current user ID

### Manual Setup Required (⚙️ Set these first)
- `{{baseUrl}}` = `http://localhost:3000`
- `{{superAdminEmail}}` = `alokhere3@gmail.com`
- `{{superAdminPassword}}` = `Alok@1234`
- `{{adminEmail}}` = Your chosen email
- `{{adminPassword}}` = Your chosen password

**How to edit:** Click ⚙️ icon → Manage Environments → Select "School ERP Local" → Edit values

---

## ✅ Verification Checklist

### Before First Request
- [ ] Environment selected: Top-right shows "School ERP Local"
- [ ] baseUrl = `http://localhost:3000`
- [ ] API running: `npm run dev`
- [ ] Database seeded: `node scripts/seedRBAC.js` (one-time)

### After Login
- [ ] Check Console (View → Show Postman Console)
- [ ] Look for: "✅ Token saved to environment"
- [ ] Open Environment quick look (eye icon) 
- [ ] Verify: `{{token}}` is not empty

---

## 🔄 Common Workflows

### Workflow 1: Super Admin Testing
```
1. Run: Auth → 🔐 Login (Super Admin)
2. Run: Auth → 👤 Register (Create School Admin)
3. Any other requests using {{token}}
```

### Workflow 2: School Admin Testing
```
1. Run: Auth → 🔓 Login (School Admin)  
   (creates separate {{adminToken}})
2. Run any School Admin endpoints
   (uses {{token}} which = {{adminToken}})
```

### Workflow 3: Switch Between Users
```
Option A (Manual Switch):
  - Copy {{superAdminToken}} value
  - Paste into {{token}}
  - All requests use Super Admin token

Option B (Re-login):
  - Run: Auth → 🔐 Login (Super Admin)
  - {{token}} auto-updates to Super Admin
```

---

## 🐛 Debugging

### Check Current Token
```
1. Open: Environment quick look (eye icon at top)
2. Find: {{token}}, {{superAdminToken}}, {{adminToken}}
3. Verify: Not empty and looks like JWT (xxx.yyy.zzz)
```

### View Request/Response
```
1. Send a request
2. Scroll down to see: Response body & headers
3. Check: Status code (200 = OK, 401 = Auth failed, 403 = Permission denied)
```

### Check Logs
```
1. View → Show Postman Console
2. Look for messages like: "✅ Token saved to environment"
3. Errors show in red
```

### If "Unauthorized" (401)
```
Solution:
1. Verify {{token}} is not empty
   - View Environment quick look
   - See {{token}} value
2. Token might be expired
   - Re-run login request
3. Check API is running
   - Terminal: npm run dev
```

---

## 🎯 Request Anatomy

### Login Request (Example)
```
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{
  "email": "{{superAdminEmail}}",
  "password": "{{superAdminPassword}}"
}
```

### Authenticated Request (Example)
```
GET {{baseUrl}}/api/students
Authorization: Bearer {{token}}
```

---

## 🚨 Token Expiration

**Default token lifetime:** 24 hours

**If you get 401 (Unauthorized):**
1. Token expired
2. Solution: Run login request again
3. New token saved automatically

---

## 📚 Advanced Features

### Custom Authorization Script
The collection includes custom scripts that:
- ✅ Extract tokens from response body
- ✅ Extract tokens from cookies
- ✅ Store in environment variables
- ✅ Inject into Authorization headers

**No setup needed** - all automatic!

### Folder-Level Scripts
- Auth folder scripts: Set tokens
- Tenants folder scripts: Use tokens from cookies if needed
- Students folder scripts: Apply row-level security

---

## 📞 Need Help?

### Issue: "No Super Admin token found"
→ Run: **Auth → 🔐 Login (Super Admin)** first

### Issue: "Role(s) not found: School Admin"
→ Run: `node scripts/seedRBAC.js` (one-time setup)

### Issue: Tokens not auto-saving
→ Check Postman Console for errors

---

## 🎓 Learning Resources

- Full Guide: [POSTMAN_SETUP_GUIDE.md](POSTMAN_SETUP_GUIDE.md)
- RBAC Info: [RBAC.md](RBAC.md)
- API Docs: [API.md](API.md)
- Setup Guide: [../SETUP_INSTRUCTIONS.md](../SETUP_INSTRUCTIONS.md)
