# Token & Cookie Flow Diagram

## Complete Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LOGIN FLOW (Step 1-5)                              │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: User sends Login Request
┌──────────────────────────────────────────┐
│  POST /api/auth/login                    │
│  {                                       │
│    "email": "admin@example.com",        │
│    "password": "password123"            │
│  }                                       │
└──────────────┬──────────────────────────┘
               │
               ▼
STEP 2: Server processes and responds
┌──────────────────────────────────────────┐
│  HTTP 200 OK                             │
│  {                                       │
│    "success": true,                     │
│    "token": "eyJhbGc...",              │
│    "tenantId": "uuid-123",             │
│    "user": { "id": "uuid-456" }        │
│  }                                       │
│  Set-Cookie: token=eyJhbGc...; ...     │
└──────────────┬──────────────────────────┘
               │
               ▼
STEP 3: Postman Test Script Runs
┌──────────────────────────────────────────────┐
│ 1. Extract from response body: response.token│
│ 2. Extract from cookies: jar().cookies      │
│ 3. Save to environment variables:           │
│    - {{token}}                              │
│    - {{superAdminToken}} or {{adminToken}}  │
│ 4. Log: "✅ Token saved to environment"     │
└──────────────┬──────────────────────────────┘
               │
               ▼
STEP 4: Token Stored in Environment
┌──────────────────────────────────────────┐
│  Environment Variables:                  │
│  - token: "eyJhbGc..."                 │
│  - superAdminToken: "eyJhbGc..."      │
│  - tenantId: "uuid-123"                │
│  - userId: "uuid-456"                  │
└──────────────┬──────────────────────────┘
               │
               ▼
STEP 5: Token Ready for Use
┌──────────────────────────────────────────┐
│  ✅ Tokens available for all requests:  │
│  → Use {{token}} in requests             │
│  → Switches between users via login     │
│  → Survives Postman restart (cookies)   │
└──────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATED REQUEST FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: Pre-Request Script Runs
┌──────────────────────────────────────────────────┐
│ 1. Check: Is {{token}} set?                     │
│    YES → Skip, use environment variable         │
│    NO  → Try to extract from cookies            │
│        → If found, save to {{token}}            │
│ 2. Log progress                                 │
└──────────────┬──────────────────────────────────┘
               │
               ▼
STEP 2: Request Built with Token
┌──────────────────────────────────────────┐
│  GET /api/students                       │
│  Authorization: Bearer {{token}}         │
│  (where {{token}} = "eyJhbGc...")       │
│                                          │
│  Actual request sent:                   │
│  GET /api/students                       │
│  Authorization: Bearer eyJhbGc...       │
└──────────────┬──────────────────────────┘
               │
               ▼
STEP 3: Server Validates Token
┌──────────────────────────────────────────┐
│ 1. Extract token from Authorization      │
│ 2. Verify signature (JWT valid?)         │
│ 3. Check expiration (not expired?)       │
│ 4. Get user from token claims            │
│ 5. Check permissions (RBAC)              │
│                                          │
│ ✅ Valid → Process request              │
│ ❌ Invalid/Expired → Return 401          │
│ ❌ No permission → Return 403            │
└──────────────┬──────────────────────────┘
               │
               ▼
STEP 4: Response with Optional New Token
┌──────────────────────────────────────────┐
│  HTTP 200 OK                             │
│  {                                       │
│    "success": true,                     │
│    "data": { ... },                    │
│    "newToken": "eyJhbGc..." (optional) │
│  }                                       │
│                                          │
│  Optional:                               │
│  Set-Cookie: token=eyJhbGc...; ...     │
└──────────────┬──────────────────────────┘
               │
               ▼
STEP 5: Test Script Updates Environment (Optional)
┌──────────────────────────────────────────┐
│ 1. If newToken in response:              │
│    Save to {{token}}                    │
│ 2. If any ID in response:               │
│    Save to {{studentId}}, etc.          │
│ 3. Next request uses updated token      │
└──────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                     TOKEN SOURCES (Priority Order)                           │
└─────────────────────────────────────────────────────────────────────────────┘

When making a request, Postman uses token from (in priority):

   1️⃣ Environment Variable
      {{token}} = "eyJhbGc..."
      ↑ Highest priority

   2️⃣ HTTP Cookies
      Automatically extracted if {{token}} is empty
      Set-Cookie: token=eyJhbGc...

   3️⃣ Not Found
      ❌ Request fails with 401


┌─────────────────────────────────────────────────────────────────────────────┐
│                   MULTI-USER TOKEN MANAGEMENT                                │
└─────────────────────────────────────────────────────────────────────────────┘

Scenario: Testing as different users

User 1: Super Admin
┌──────────────────────────┐
│ superAdminToken:         │
│ "eyJhbGc...SA"          │
└──────────────────────────┘
         ↑
         │ (for Admin-only operations)
         │

User 2: School Admin
┌──────────────────────────┐
│ adminToken:              │
│ "eyJhbGc...SA2"         │
└──────────────────────────┘
         ↑
         │ (for School Admin operations)
         │

User 3: Teacher
┌──────────────────────────┐
│ teacherToken:            │
│ "eyJhbGc...TC"          │
└──────────────────────────┘
         ↑
         │ (for Teacher operations)
         │

Active Token
┌──────────────────────────┐
│ token: "eyJhbGc...SA"   │ ← Controls which user is active
│ (currently = Super Admin)│
└──────────────────────────┘
         ↑
         │
    Used in ALL requests


SWITCHING USERS:

Method 1: Re-login
┌─────────────────────────┐
│ Run login request      │
│ {{token}} auto-updates │
└─────────────────────────┘

Method 2: Manual switch
┌──────────────────────────────────────┐
│ Set {{token}} = {{adminToken}}      │
│ All requests now use admin token    │
└──────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│              COOKIE PERSISTENCE (Postman continues after restart)            │
└─────────────────────────────────────────────────────────────────────────────┘

Browser-like Cookie Handling:

Time 0: First Login
┌─────────────────────────────────────────┐
│ 1. Send: POST /api/auth/login          │
│ 2. Receive: Set-Cookie: token=...      │
│ 3. Postman stores in cookie jar        │
│ 4. Extract to {{token}} environment    │
└─────────────────────────────────────────┘
         ↓
Time 1: Other Requests
┌─────────────────────────────────────────┐
│ 1. Pre-request checks {{token}}        │
│ 2. If empty: extract from cookies      │
│ 3. Use cookie value if available       │
└─────────────────────────────────────────┘
         ↓
Time 2: Postman Restart
┌─────────────────────────────────────────┐
│ 1. Cookies persist (like browser)      │
│ 2. No {{token}} in environment         │
│ 3. First request extracts from cookies │
│ 4. {{token}} re-populated              │
│ 5. All subsequent requests work        │
└─────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR FLOW (401/403)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Request Fails
         │
         ▼
    ┌─────────┐
    │ Status? │
    └────┬────┘
         │
         ├─ 401 Unauthorized ──→ Token missing/invalid/expired
         │                       Solution: Re-run login request
         │
         ├─ 403 Forbidden ─────→ User lacks permission
         │                       Solution: Use different user (e.g., Super Admin)
         │
         └─ 500 Server Error ─→ API error
                                Solution: Check server logs


┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEY TAKEAWAYS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

✅ Automatic Token Management
   - Login → Token auto-saved to environment
   - Test scripts handle extraction
   - Pre-request scripts inject into requests

✅ Works with Cookies
   - API sets cookies: Set-Cookie: token=...
   - Postman extracts automatically
   - Works across restarts

✅ Multi-User Support
   - Store multiple tokens: {{superAdminToken}}, {{adminToken}}, etc.
   - Switch via {{token}} variable
   - Re-login to update any token

✅ Authorization Flow
   - Every request: Authorization: Bearer {{token}}
   - Server validates token
   - Returns 401 if invalid, 403 if no permission

✅ Debugging
   - View → Show Console → See extraction logs
   - Environment quick look → Check token values
   - Network tab → Check request headers
