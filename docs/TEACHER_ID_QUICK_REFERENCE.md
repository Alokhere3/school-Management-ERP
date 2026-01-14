# Teacher ID Auto-Generation - Quick Reference

## What Changed?

✅ **teacherId is now OPTIONAL** when creating teachers  
✅ **Auto-generated sequentially** starting from 1 per school/tenant  
✅ **Each school has independent numbering** (School A starts at 1, School B also starts at 1)

## How It Works

### Scenario 1: User Doesn't Provide teacherId
```
Request: POST /api/teachers
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@school.com",
  "password": "securepassword123"
  // NO teacherId field
}

Response: 201 Created
{
  "teacherId": "1"  // ← Auto-generated!
}

Next teacher created → teacherId: "2"
Next teacher created → teacherId: "3"
```

### Scenario 2: User Provides Custom teacherId
```
Request: POST /api/teachers
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@school.com",
  "password": "securepassword123",
  "teacherId": "CUSTOM_001"  // ← Custom ID
}

Response: 201 Created
{
  "teacherId": "CUSTOM_001"  // ← Uses provided ID
}
```

## For Each School (Tenant)

```
School A:
  Teacher 1 → ID: 1
  Teacher 2 → ID: 2
  Teacher 3 → ID: 3

School B (Different school):
  Teacher 1 → ID: 1  (Independent!)
  Teacher 2 → ID: 2
```

## Implementation Details

| Component | Change |
|-----------|--------|
| **routes/teachers.js** | teacherId is now `.optional()` |
| **TeacherRepository.js** | Added `generateNextTeacherId()` method |
| **TeacherRepository.js** | Updated `createTeacher()` to use generation |
| **teacherController.js** | Updated documentation |

## Method: generateNextTeacherId()

```javascript
async generateNextTeacherId(tenantId, transaction = null)
```

**Input:** Tenant ID (School ID)  
**Output:** Next teacher ID as string ("1", "2", "3", etc.)  
**Logic:**
1. Find highest numeric teacherId for this tenant
2. Increment by 1
3. Return as string
4. If no teachers exist, return "1"

## Validation

✅ Uniqueness is enforced within each tenant  
✅ Duplicate IDs are rejected with 409 error  
✅ RLS and tenant isolation still enforced  

## Logging

All ID generations are logged:
```
[TeacherRepository.createTeacher] Generated teacherId: 1 for tenant: 5302233e-b7b1...
[TeacherRepository.createTeacher] Using provided teacherId: CUSTOM_001
```

## Backward Compatibility

- Old API calls with `teacherId` → Still work ✓
- New API calls without `teacherId` → Auto-generate ✓
- Mixed usage → No issues ✓

## Common Scenarios

### First Teacher in New School
```
POST /api/teachers { firstName, lastName, email, password }
→ teacherId auto-generated: "1"
```

### Additional Teachers  
```
POST /api/teachers { firstName, lastName, email, password }
→ teacherId auto-generated: "2" (incremented from last)

POST /api/teachers { firstName, lastName, email, password }
→ teacherId auto-generated: "3"
```

### Manual Override
```
POST /api/teachers { firstName, lastName, email, password, teacherId: "TEACHER_ABC" }
→ teacherId used: "TEACHER_ABC" (as provided)
```

## Error Cases

| Situation | Response |
|-----------|----------|
| Auto-generated ID = 1 (first teacher) | 201 ✓ |
| Auto-generated ID = 5 (5th teacher) | 201 ✓ |
| Duplicate ID attempted | 409 ✗ |
| Email conflict | 409 ✗ |
| Missing required field | 400 ✗ |

---

**Files Modified:**
- `routes/teachers.js` - Validation
- `repositories/TeacherRepository.js` - Logic + Method
- `controllers/teacherController.js` - Documentation

**Ready to use!** No migration needed. Works with old and new API patterns.
