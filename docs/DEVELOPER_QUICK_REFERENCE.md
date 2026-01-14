# Quick Reference: New RLS Architecture

## For Developers Adding New Roles

### 1. Add role to PermissionScope

```javascript
// models/PermissionScope.js
static ROLE_PERMISSION_MAP = {
    student: {
        admin: 'TENANT',
        school_admin: 'TENANT',
        teacher: 'OWNED',
        tutor: 'OWNED',         // ← NEW ROLE
        parent: 'OWNED',
        student: 'SELF'
    },
    // ... other resources
};
```

**No code changes needed elsewhere.** Routing happens automatically via PermissionScope.getMaxScope().

---

## For Repository Implementers

### Override applyOwnedFilter for custom logic

```javascript
// repositories/CustomRepository.js
class CustomRepository extends BaseRepository {
    constructor(model) {
        super(model, 'custom'); // Pass resourceName
    }

    applyOwnedFilter(where, userContext, action = 'read') {
        const { roles, userId } = userContext;
        
        // Check multiple conditions
        if (roles.some(r => r.includes('manager'))) {
            where.managedBy = userId;
            return where;
        }
        
        if (roles.some(r => r.includes('teacher'))) {
            // Teachers see assigned resources
            where.assignedTo = userId;
            return where;
        }
        
        // Default OWNED
        where.userId = userId;
        return where;
    }
}
```

---

## For Adding New Endpoints

### 1. Create repository
```javascript
// repositories/ReportRepository.js
class ReportRepository extends BaseRepository {
    constructor(model) {
        super(model, 'report');
    }
    // Override applyOwnedFilter if needed
}
```

### 2. Use in controller
```javascript
const { repos } = require('../repositories/RepositoryFactory');

exports.getReports = async (req, res) => {
    try {
        const reports = await repos.report.findAllWithRLS(
            req.userContext,
            { status: 'active' },
            { limit: 20, page: 1 }
        );
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
```

### 3. Map role to scope
```javascript
// models/PermissionScope.js - add resource
static ROLE_PERMISSION_MAP = {
    // ...
    report: {
        admin: 'TENANT',
        school_admin: 'TENANT',
        teacher: 'OWNED',      // See own reports
        student: 'SELF'        // See own report only
    }
};
```

---

## Scope Rules Cheat Sheet

| Scope | See | Examples |
|-------|-----|----------|
| **TENANT** | All records in tenant | Admin sees all students |
| **OWNED** | Records user owns/created | Teacher sees assigned students |
| **SELF** | Only own record | Student sees own record only |
| **NONE** | No access (empty results) | Guest user = no access |

---

## Role Precedence

When user has multiple roles:
```javascript
const roles = ['student', 'teacher', 'admin'];
const scope = PermissionScope.getMaxScope('student', roles);
// Returns: 'TENANT' (admin's scope wins)

// Precedence: TENANT > OWNED > SELF > NONE
```

---

## Testing Role Changes

### Test: Role change takes effect immediately

```javascript
// 1. Login as teacher
const token = loginAsTeacher();

// 2. Get students (should see assigned)
const resp1 = await getStudents(token);
assert(resp1.data.length > 0);

// 3. Change role to student
changeUserRole(userId, 'student');

// 4. Get students AGAIN (no re-login!)
const resp2 = await getStudents(token);
// Should now see only own record
assert(resp2.data.length === 1);
```

---

## Rate Limiting Tiers

```javascript
// Automatic based on user type:

// Unauthenticated: 50 req/15min
GET /api/auth/login  // 150 attempts

// Basic user: 300 req/15min
GET /api/students    // Authenticated user
POST /api/students   // Same user

// Admin/Power user: 600 req/15min  
GET /api/students    // SCHOOL_ADMIN role
POST /api/reports    // ADMIN role

// Internal API: 2000 req/15min
GET /api/data -H "x-api-key: secret"
```

---

## Permission Resolver Caching

```javascript
// Services/PermissionResolver.js

// Get fresh roles (DB + cache)
const roles = await resolver.resolveRoles(userId, tenantId);
// Cache: Key = "perms:{userId}:{tenantId}:roles"
// TTL: 10 minutes

// Invalidate when roles change
await resolver.invalidateCache(userId, tenantId);
// Next request: Fresh from DB
```

---

## JWT Structure

### New (Post-Refactoring)
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "type": "access",
  "iat": 1641600000,
  "exp": 1641900000
}
```

### Roles Resolution
```javascript
// Middleware: enhancedRls.js
const roles = await permissionResolver.resolveRoles(userId, tenantId);
// Returns: ['admin', 'teacher'] from database

req.userContext = {
    userId,
    tenantId,
    roles,  // FROM DATABASE (fresh)
    source: 'database'
};
```

---

## Common Issues & Solutions

### Issue: "New role not working"
**Solution:** Check PermissionScope.ROLE_PERMISSION_MAP
```javascript
// models/PermissionScope.js
student: {
    myNewRole: 'OWNED'  // Add here
}
```

### Issue: "User can see too much data"
**Solution:** Check applyOwnedFilter implementation
```javascript
// repositories/StudentRepository.js
applyOwnedFilter(where, userContext) {
    // Ensure correct userId/managerId/etc filter
    where.teacherId = userContext.userId;
    return where;
}
```

### Issue: "Deleted records reappear"
**Solution:** Soft-delete is automatic now
```javascript
// All queries include: deletedAt: { [Op.is]: null }
// Verified in: buildTenantFilter()
```

### Issue: "Rate limit hitting too fast"
**Solution:** Check user role for correct tier
```javascript
// Admin users: 600 req/15min (not 300)
// Check: isAdmin() returns true
```

---

## Debugging RLS

### Server logs show scope resolution
```
[2026-01-08T20:21:00.000Z] DEBUG: RLS_SCOPE_RESOLUTION
  resource: student
  roles: ['teacher']
  scope: OWNED
  userId: 550e8400-e29b-41d4-a716-446655440000
  tenantId: f47ac10b-58cc-4372-a567-0e02b2c3d479
```

### Enable debug logging
```bash
DEBUG=express-rate-limit,sequelize npm start
```

### Check JWT payload online
```javascript
// Paste token at jwt.io to see payload structure
// Should NOT have 'roles' field (only userId, tenantId, type)
```

---

## Performance Tips

### 1. Enable Redis caching
```javascript
// Add to PermissionResolver
const redis = require('redis');
const cache = redis.createClient();
const resolver = new PermissionResolver(User, Role, cache);
```

### 2. Add database indexes
```javascript
// Migration: XXX_add_rls_indexes.js
queryInterface.addIndex('students', ['tenantId', 'userId']);
queryInterface.addIndex('students', ['tenantId', 'createdAt']);
```

### 3. Separate count queries
```javascript
// Instead of: findAndCountAll()
const rows = await findAll({ limit, offset });
const count = await cache.get(`count:${key}`) || 
              await Model.count({ where });
```

---

## Useful Commands

```bash
# Start server with debug logs
DEBUG=* npm start

# Test rate limiting
for i in {1..350}; do curl http://localhost:3000/api/students; done
# Should fail at 301st request (300 limit for basic users)

# Verify RLS
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/students

# Check JWT
echo "$TOKEN" | jq -R 'split(".") | .[1] | @base64d'

# Monitor logs
npm start 2>&1 | grep "RLS\|RATE_LIMIT\|SCOPE"
```

---

## Migration Checklist

- [ ] Deploy new code (models/PermissionScope.js, etc.)
- [ ] Verify server starts without errors
- [ ] Test one protected endpoint (should work as before)
- [ ] Test rate limiting (should auto-tier based on role)
- [ ] Verify JWT has no 'roles' field
- [ ] Update remaining repositories (Staff, Class, User)
- [ ] Add Redis caching (optional, for performance)
- [ ] Run load test (5k concurrent users)
- [ ] Update documentation for team
- [ ] Deploy to production

---

## Quick Links

- **Implementation Guide:** `/docs/ARCHITECTURAL_REFACTORING.md`
- **Security Flow:** `/docs/RLS_SECURITY_FLOW.md`  
- **Completion Report:** `/docs/PHASE_2_4_COMPLETION_REPORT.md`
- **Models:** `models/PermissionScope.js`
- **Services:** `services/PermissionResolver.js`
- **Middleware:** `middleware/enhancedRls.js`
- **Config:** `config/rateLimiters.js`

---

**Last Updated:** January 8, 2026  
**Version:** 1.0 (Production Ready)  
**Author:** Architecture Refactoring Team
