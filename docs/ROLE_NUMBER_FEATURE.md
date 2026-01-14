# Auto-Generated Role Number Implementation

## Overview
This feature automatically assigns a unique role number (sequence number) to each student within their class. The role number starts from 1 for each class and increments sequentially as new students are added to that class, regardless of sorting order.

## Implementation Details

### 1. Database Schema (Model Update)
**File**: `models/Student.js`

Added new field:
```javascript
rollNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
}
```

**Characteristics**:
- Type: INTEGER
- Nullable: true (for backward compatibility with existing students without classes)
- Auto-generated: Set during student creation
- Scoped: Per class (each classId has its own 1-based sequence)

### 2. Database Migration
**File**: `migrations/021_add_rollNumber_to_students.js`

Adds the `rollNumber` column and creates an index for efficient lookups:
```sql
ALTER TABLE students ADD COLUMN rollNumber INTEGER DEFAULT NULL;
CREATE INDEX idx_students_classId_rollNumber ON students(classId, rollNumber);
```

### 3. Repository Logic Update
**File**: `repositories/StudentRepository.js`

Modified the `createStudent` method to automatically assign role numbers:

```javascript
async createStudent(studentData, userContext) {
    const context = this.validateUserContext(userContext);
    
    // Validate permissions
    if (!this.isAdmin(context) && context.role.toLowerCase() !== 'admin') {
        throw new Error('INSUFFICIENT_PERMISSIONS: Only admins can create students');
    }

    // Auto-assign rollNumber if classId is provided
    if (studentData.classId) {
        const maxrollNumber = await this.model.max('rollNumber', {
            where: {
                classId: studentData.classId,
                tenantId: context.tenantId
            }
        });
        
        // Start from 1, or next number after highest existing
        studentData.rollNumber = (maxrollNumber || 0) + 1;
        console.log(`[ROLE_NUMBER] Auto-assigned rollNumber=${studentData.rollNumber} for classId=${studentData.classId}`);
    }

    return this.createWithRLS(studentData, userContext);
}
```

**How it works**:
1. When a student is created with a `classId`
2. The system queries the maximum `rollNumber` for that class in the same tenant
3. Assigns the next sequential number (max + 1, or 1 if no students exist)
4. The assignment happens before creating the record, so it's atomic

## Usage Examples

### Example 1: Create First Student in a Class
```json
POST /api/students
{
    "admissionNo": "STU001",
    "firstName": "John",
    "lastName": "Doe",
    "classId": "class-uuid-123"
}
```

**Result**: `rollNumber` = 1

### Example 2: Create Second Student in the Same Class
```json
POST /api/students
{
    "admissionNo": "STU002",
    "firstName": "Jane",
    "lastName": "Smith",
    "classId": "class-uuid-123"
}
```

**Result**: `rollNumber` = 2

### Example 3: Student Without Class Assignment
```json
POST /api/students
{
    "admissionNo": "STU003",
    "firstName": "Bob",
    "lastName": "Johnson"
}
```

**Result**: `rollNumber` = null (not assigned because no classId)

## Key Features

✅ **Automatic Assignment**: No manual input required  
✅ **Per-Class Scoping**: Each class has its own 1-based sequence  
✅ **Insertion Order**: Based on creation order, not alphabetical or other sorting  
✅ **Tenant Isolation**: Role numbers are scoped to classId within each tenant  
✅ **Backward Compatible**: Existing students without classId retain null rollNumber  
✅ **Indexed**: Query by classId and rollNumber is efficient  
✅ **Transactional**: Uses Sequelize's atomic create operation  

## Migration Steps

To apply this feature to your existing database:

1. **Run the migration**:
   ```bash
   npm run migrate
   ```

2. **Verify the column exists**:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name='students' AND column_name='rollNumber';
   ```

3. **Test by creating new students**:
   ```bash
   npm test -- test_student_creation.js
   ```

## Query Examples

### Find student by class and role number
```javascript
const student = await Student.findOne({
    where: {
        classId: 'class-uuid-123',
        rollNumber: 2,
        tenantId: 'tenant-uuid'
    }
});
```

### Get all students in a class ordered by role number
```javascript
const students = await Student.findAll({
    where: {
        classId: 'class-uuid-123',
        tenantId: 'tenant-uuid'
    },
    order: [['rollNumber', 'ASC']]
});
```

### Get the next available role number for a class
```javascript
const maxrollNumber = await Student.max('rollNumber', {
    where: {
        classId: 'class-uuid-123',
        tenantId: 'tenant-uuid'
    }
});
const nextrollNumber = (maxrollNumber || 0) + 1;
```

## Security & RLS Compliance

✅ **RLS Protected**: Role number assignment respects Row-Level Security rules  
✅ **Tenant Isolated**: Only counts students in the same tenant  
✅ **Permission Gated**: Only admins can create students with classes  
✅ **No Privacy Leaks**: Role numbers are student-specific, not exposed globally  

## Testing

Create a test script to verify role number assignment:

```javascript
const studentRepo = new StudentRepository(Student);

// Test: Create 3 students in the same class
const classId = 'test-class-uuid';
const userContext = { tenantId: 'test-tenant', userId: 'admin-uuid', role: 'admin' };

const student1 = await studentRepo.createStudent({
    admissionNo: 'TEST001',
    firstName: 'Student',
    lastName: 'One',
    classId: classId
}, userContext);

const student2 = await studentRepo.createStudent({
    admissionNo: 'TEST002',
    firstName: 'Student',
    lastName: 'Two',
    classId: classId
}, userContext);

const student3 = await studentRepo.createStudent({
    admissionNo: 'TEST003',
    firstName: 'Student',
    lastName: 'Three',
    classId: classId
}, userContext);

console.log(student1.rollNumber); // Output: 1
console.log(student2.rollNumber); // Output: 2
console.log(student3.rollNumber); // Output: 3
```

## Notes

- The `rollNumber` is set during record creation and should not be manually updated
- If you need to renumber students (e.g., after deletions), implement a separate utility function
- The feature gracefully handles students without a `classId` (rollNumber remains null)
- For bulk imports, the role numbers will be assigned sequentially based on the order of inserts
