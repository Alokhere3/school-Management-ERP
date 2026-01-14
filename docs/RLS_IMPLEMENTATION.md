# Row-Level Security (RLS) Implementation Guide

## Overview

This guide explains the mandatory Row-Level Security (RLS) architecture implemented across the School ERP system. All data access is now centralized in the Repository layer, ensuring tenant isolation and role-based access control at the database query level.

## Critical Security Principle

**ONE MISSED FILTER = DATA BREACH**

Data cannot be accessed directly from models anywhere in the codebase. All data access MUST flow through repositories to enforce RLS.

## Architecture

### Layered Approach

```
┌─────────────────────────────────────────────┐
│           HTTP Request                      │
├─────────────────────────────────────────────┤
│    Authentication Middleware                │
│    (req.user extracted from JWT)            │
├─────────────────────────────────────────────┤
│    RLS Middleware                           │
│    (req.userContext standardized)           │
├─────────────────────────────────────────────┤
│    Controllers                              │
│    (No data access logic here)              │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │   Repository Layer (RLS ENFORCED)       │ │
│ │ ┌───────────────────────────────────┐   │ │
│ │ │ 1. Validate user context          │   │ │
│ │ │ 2. Build tenant filter            │   │ │
│ │ │ 3. Apply role-based RLS           │   │ │
│ │ │ 4. Execute query                  │   │ │
│ │ │ 5. Audit log access               │   │ │
│ │ └───────────────────────────────────┘   │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│    Sequelize ORM                            │
│    (Queries only what repository asks)      │
├─────────────────────────────────────────────┤
│    Database                                 │
│    (Physical data isolation via schema)     │
└─────────────────────────────────────────────┘
```

## Repository Pattern

### Base Repository

All repositories extend `BaseRepository` which enforces:

1. **User Context Validation**
   ```javascript
   validateUserContext(userContext) {
       // Ensures userId and tenantId are present
       // Normalizes roles array
       // Returns standardized context
   }
   ```

2. **Mandatory Tenant Isolation**
   ```javascript
   buildTenantFilter(userContext) {
       return { tenantId: userContext.tenantId };
   }
   ```
   Every query includes `tenantId` filter. This prevents cross-tenant data leakage.

3. **Role-Based RLS**
   ```javascript
   applyRLSFilters(where, userContext, action) {
       // Admin: See all data in tenant
       // Teacher: See only assigned students
       // Parent: See only own children
       // Student: See only own record
   }
   ```

4. **Audit Logging**
   ```javascript
   auditLog(action, userContext, details) {
       // Logs all data access for security monitoring
   }
   ```

### Entity-Specific Repositories

Each entity has a dedicated repository:

#### StudentRepository

```javascript
// Bad - FORBIDDEN
Student.findAll({ where: { tenantId } }); // Can miss RLS filters!

// Good - MANDATORY
const students = await studentRepo.findVisibleStudents(userContext, filters, options);
```

RLS Rules for Students:
- **Admin**: See all students in their tenant
- **Teacher**: See students in their classes (filtered by `teacherId`)
- **Parent**: See only own children (filtered by `parentOf = userId`)
- **Student**: See only own record (filtered by `userId`)

#### StaffRepository

```javascript
const staff = await staffRepo.findVisibleStaff(userContext, filters, options);
```

RLS Rules for Staff:
- **Admin**: See all staff
- **HR Manager**: See all staff
- **Principal**: See all staff
- **Staff**: See only own record

#### UserRepository

```javascript
const users = await userRepo.findVisibleUsers(userContext, filters, options);
```

RLS Rules for Users:
- **Admin**: See all users
- **User**: See only own record

#### ClassRepository

```javascript
const classes = await classRepo.findVisibleClasses(userContext, filters, options);
```

RLS Rules for Classes:
- **Admin**: See all classes
- **Teacher**: See own classes
- **Student**: See own class

## Implementation in Controllers

### Before (INSECURE)

```javascript
const listStudents = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const query = { tenantId };
    
    // DANGER: Controller-based RLS is incomplete!
    if (req.permission?.level === 'limited') {
        if (req.user.role === 'teacher') {
            query.teacherId = req.user.id; // Easy to forget this!
        }
    }
    
    // DANGER: Direct model access bypasses any missed filters!
    const students = await Student.findAll({ where: query });
    res.json({ success: true, data: students });
});
```

Problems:
- Missing filters = data breach
- Not centralized = inconsistent
- Hard to audit
- Role checks scattered everywhere

### After (SECURE)

```javascript
const { RepositoryFactory } = require('../repositories');
const repos = new RepositoryFactory();

const listStudents = asyncHandler(async (req, res) => {
    const userContext = req.userContext || req.user;
    
    // Simple, clean controller
    const filters = classId ? { classId } : {};
    const options = { page: Number(page), limit: Number(limit) };
    
    // RLS ENFORCED: Repository handles ALL access control
    const { count, rows } = await repos.student.findVisibleStudents(
        userContext, 
        filters, 
        options
    );
    
    res.json({ success: true, data: rows, pagination: { total: count } });
});
```

Benefits:
- RLS enforced at data layer
- Controllers are simple and clean
- Impossible to miss a filter
- Centralized and auditable

## Key Methods

### Reading Data (RLS Enforced)

```javascript
// Single record with RLS
const student = await studentRepo.findStudentById(id, userContext);

// List with RLS
const { count, rows } = await studentRepo.findVisibleStudents(
    userContext, 
    filters,     // Additional filters
    options      // Pagination, sorting
);

// Count with RLS
const count = await studentRepo.countVisibleStudents(userContext, filters);

// Search with RLS
const results = await studentRepo.searchStudents(term, userContext);
```

### Writing Data (RLS Enforced)

```javascript
// Create - Tenant ID is forced, cannot be overridden
const student = await studentRepo.createStudent(data, userContext);

// Update - Only accessible records can be modified
await studentRepo.updateStudent(id, updates, userContext);

// Delete - Only accessible records can be deleted
await studentRepo.deleteStudent(id, userContext);
```

## RLS Middleware

Install RLS middleware in server.js:

```javascript
const { initializeUserContext } = require('./middleware/rls');

// After authentication middleware
app.use(authenticateToken);
app.use(initializeUserContext);  // Standardize user context

// Now all controllers have access to req.userContext
```

The middleware:
1. Validates user context from token
2. Standardizes it into expected format
3. Ensures tenantId and userId are present
4. Normalizes roles array

## Tenant Isolation Guarantee

Every repository query includes mandatory tenant filtering:

```javascript
// This happens in EVERY repository method:
const where = this.applyRLSFilters(filters, userContext, action);
// Result includes: { tenantId: userContext.tenantId, ...otherFilters }
```

**Therefore:**
- One tenant's data can NEVER leak to another
- Even if RLS role filter is missed, tenant filter prevents breach
- Each query is inherently isolated

## Audit Trail

Every data access is logged:

```
{
    message: 'RLS_DATA_ACCESS',
    model: 'Student',
    action: 'findById',
    userId: 'user-123',
    tenantId: 'tenant-456',
    role: 'teacher',
    timestamp: '2024-01-08T10:30:00Z',
    details: 'id=student-789'
}
```

This enables:
- Security monitoring
- Compliance audits
- Incident investigation
- Usage analytics

## Migration Checklist

When updating an existing controller:

- [ ] Replace direct `Model.findAll()` with `repo.findVisibleXxx()`
- [ ] Replace `Model.findOne()` with `repo.findXxxById()`
- [ ] Replace `Model.create()` with `repo.createXxx()`
- [ ] Replace `Model.update()` with `repo.updateXxx()`
- [ ] Replace `Model.destroy()` with `repo.deleteXxx()`
- [ ] Ensure `req.userContext` is passed to all repository calls
- [ ] Remove manual RLS checks from controller (repository handles it)
- [ ] Test with different roles to verify RLS works

## Best Practices

### ✅ DO

```javascript
// Pass user context to every repository call
const students = await studentRepo.findVisibleStudents(userContext, filters);

// Let repository handle access validation
try {
    await studentRepo.deleteStudent(id, userContext);
} catch (err) {
    if (err.message.includes('INSUFFICIENT_PERMISSIONS')) {
        return sendError(res, { status: 403, body: { error: 'Access denied' } });
    }
}

// Use standardized filters
const filters = { classId, status: 'active' };
```

### ❌ DON'T

```javascript
// DON'T access models directly
const students = await Student.findAll({ where: { tenantId } });

// DON'T build manual RLS checks
if (req.user.role === 'teacher') {
    query.teacherId = req.user.id;  // Easy to miss!
}

// DON'T forget userContext
await studentRepo.findVisibleStudents(filters);  // Missing userContext!
```

## Extending for New Entities

To add RLS for a new entity:

1. **Create Repository**
   ```javascript
   class ArticleRepository extends BaseRepository {
       applyRLSFilters(where, userContext, action) {
           // Define role-specific rules
           const baseWhere = { 
               ...where, 
               ...this.buildTenantFilter(userContext) 
           };
           
           if (userContext.role === 'author') {
               baseWhere.authorId = userContext.userId;
           }
           return baseWhere;
       }
   }
   ```

2. **Add to RepositoryFactory**
   ```javascript
   get article() {
       if (!this._articleRepo) {
           this._articleRepo = new ArticleRepository(Article);
       }
       return this._articleRepo;
   }
   ```

3. **Use in Controller**
   ```javascript
   const articles = await repos.article.findVisibleArticles(userContext, filters);
   ```

## Testing RLS

```javascript
// Test as different roles
const adminContext = { userId: 'admin-1', tenantId: 'tenant-1', role: 'admin' };
const teacherContext = { userId: 'teacher-1', tenantId: 'tenant-1', role: 'teacher' };
const studentContext = { userId: 'student-1', tenantId: 'tenant-1', role: 'student' };

// Admin sees all
const adminStudents = await studentRepo.findVisibleStudents(adminContext);
// Teacher sees only their students
const teacherStudents = await studentRepo.findVisibleStudents(teacherContext);
// Student sees only own record
const ownRecord = await studentRepo.findVisibleStudents(studentContext);
```

## Troubleshooting

### Issue: "USER_CONTEXT_REQUIRED" Error

```
ERROR: USER_CONTEXT_REQUIRED: RLS cannot be enforced without user context
```

**Solution**: Ensure RLS middleware is installed and controller is passing `userContext`:
```javascript
const userContext = req.userContext || req.user;
const students = await studentRepo.findVisibleStudents(userContext, filters);
```

### Issue: "TENANT_ISOLATION_FAILED" Error

```
ERROR: TENANT_ISOLATION_FAILED: User context missing tenantId
```

**Solution**: Check that JWT includes `tenantId`:
```javascript
// In token generation
const token = jwt.sign({
    userId: user.id,
    tenantId: user.tenantId,  // Must be present!
    role: user.role
}, secret);
```

### Issue: User sees data from other tenants

This shouldn't happen because tenant filter is mandatory. Check:
1. Is RLS middleware installed?
2. Is controller passing `userContext` to repository?
3. Is `userContext.tenantId` correctly set in JWT?

## Security Guarantees

With proper implementation:

1. **Tenant Isolation** ✓
   - Every query includes tenantId filter
   - Impossible to query across tenants

2. **Role-Based Access** ✓
   - Each role has defined RLS rules
   - Applied at data layer

3. **Data Ownership** ✓
   - Users access only data they have permission for
   - Parents see only their children
   - Teachers see only their students

4. **Audit Trail** ✓
   - All access is logged
   - Can trace who accessed what and when

5. **No Single Point of Failure** ✓
   - Tenant filter catches most breaches
   - RLS filter catches remaining cases
