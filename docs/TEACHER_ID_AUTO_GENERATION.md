# Teacher ID Auto-Generation Implementation

## Overview
Updated the teacher creation endpoint to automatically generate `teacherId` if not provided. Each school/tenant has its own independent teacher ID sequence starting from 1.

## Changes Made

### 1. **Routes** (`routes/teachers.js`)
- **Changed**: Made `teacherId` parameter optional in the `validateCreateTeacher` validation middleware
- **Before**: `teacherId` was required (`.notEmpty()`)
- **After**: `teacherId` is optional (`.optional({ checkFalsy: true })`)
- **Impact**: API clients can now omit `teacherId` from create teacher requests

### 2. **Repository** (`repositories/TeacherRepository.js`)

#### Added New Method: `generateNextTeacherId()`
```javascript
async generateNextTeacherId(tenantId, transaction = null)
```

**Features:**
- Finds the highest numeric `teacherId` for the given tenant
- Increments it by 1 for the next teacher
- Starts from `1` if no teachers exist for the tenant
- Handles non-numeric IDs gracefully (resets to 1)
- Supports Sequelize transactions for consistency

**Logic:**
1. Query for the teacher with the highest `teacherId` in the tenant
2. Parse the ID as an integer
3. Return `String(lastId + 1)`
4. If no teachers exist or ID is non-numeric, return `'1'`

#### Updated Method: `createTeacher()`
**Changes:**
- Auto-generates `teacherId` if not provided by user
- Uses `generateNextTeacherId()` method for generation
- Validates uniqueness of the generated/provided `teacherId` for the tenant
- Logs generation event for audit trail
- Throws `409 DUPLICATE_TEACHER_ID` if ID already exists

**Creation Flow:**
```
1. User submits teacher creation request (with or without teacherId)
2. If teacherId provided:
   - Verify it's unique for the tenant
   - Use provided ID
3. If teacherId NOT provided:
   - Call generateNextTeacherId(tenantId)
   - Get next sequential number
   - Verify uniqueness (should always pass)
   - Use generated ID
4. Create User + Teacher records with final teacherId
```

### 3. **Controller** (`controllers/teacherController.js`)
- **Updated**: API documentation for `createTeacher` endpoint
- **New**: Mentions auto-generation behavior
- **Clarified**: `teacherId` is optional but auto-generated

## Per-Tenant ID Sequences

### Example Scenario:
```
Tenant A (School A):
- Teacher 1: teacherId = "1"
- Teacher 2: teacherId = "2"
- Teacher 3: teacherId = "3"

Tenant B (School B):
- Teacher 1: teacherId = "1"  (independent sequence)
- Teacher 2: teacherId = "2"
```

Each tenant maintains its own sequence, starting fresh from 1.

## Database Query Performance

The `generateNextTeacherId()` method uses:
- **Index**: Should be on `(tenantId, deletedAt, teacherId)` for optimal performance
- **Query Type**: `ORDER BY teacherId DESC LIMIT 1` - efficient retrieval of highest ID
- **Transaction Support**: Can be used within a larger transaction to ensure consistency

## API Changes

### Before
```http
POST /api/teachers
Content-Type: multipart/form-data

firstName=John
lastName=Doe
email=john@school.com
password=securepassword123
teacherId=T001    <-- REQUIRED
```

### After
```http
POST /api/teachers
Content-Type: multipart/form-data

firstName=John
lastName=Doe
email=john@school.com
password=securepassword123
teacherId=          <-- OPTIONAL (will be auto-generated)

OR

firstName=John
lastName=Doe
email=john@school.com
password=securepassword123
teacherId=CUSTOM_ID  <-- Can still provide custom ID
```

## Error Handling

| Scenario | Status | Error Code | Message |
|----------|--------|-----------|---------|
| No teachers in tenant | 201 | - | teacherId = "1" (auto-generated) |
| Multiple teachers exist | 201 | - | teacherId = "{nextNum}" (auto-generated) |
| User provides duplicate ID | 409 | DUPLICATE_TEACHER_ID | teacherId already exists for this tenant |
| Email already exists | 409 | DUPLICATE_EMAIL | Email already exists for this tenant |

## Logging

The implementation logs all ID generation events for audit trail:

```javascript
// First teacher for a tenant
[TeacherRepository.generateNextTeacherId] First teacher for tenant {tenantId}, starting from 1

// Auto-generated ID
[TeacherRepository.createTeacher] Generated teacherId: {nextId} for tenant: {tenantId}

// User provided ID
[TeacherRepository.createTeacher] Using provided teacherId: {customId}
```

## Security & RLS

- ✅ Tenant isolation maintained - ID sequences are per-tenant only
- ✅ RLS enforcement not affected
- ✅ All queries use tenant filter
- ✅ Duplicate ID check prevents data integrity issues

## Testing Recommendations

1. **Create first teacher without ID** → Should get teacherId = "1"
2. **Create second teacher without ID** → Should get teacherId = "2"
3. **Create teacher with custom ID** → Should use provided ID
4. **Attempt duplicate auto-generated ID** → Should fail gracefully
5. **Multi-tenant test** → Different schools should have independent sequences

## Backward Compatibility

- ✅ Old requests with `teacherId` still work
- ✅ New requests without `teacherId` are auto-generated
- ✅ API accepts both patterns seamlessly
