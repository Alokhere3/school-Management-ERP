# Teacher Management API - Production Implementation Guide

Complete multi-tenant Teacher Management system with RLS, S3 file storage, and transaction support.

---

## Architecture Overview

### Files Created

```
models/Teacher.js                    - Sequelize model with all teacher fields
repositories/TeacherRepository.js     - Repository layer with RLS enforcement
controllers/teacherController.js      - Controller with file handling & transactions
routes/teachers.js                    - Express routes with validation
```

### Key Features Implemented

✅ **Multi-Tenant Isolation** - Every query filters by `tenantId`
✅ **Row-Level Security** - RLS enforced in repository layer
✅ **Transactions** - Create/Update/Delete use DB transactions
✅ **S3 File Storage** - Presigned URLs for secure file access
✅ **Password Hashing** - bcrypt with cost factor 10
✅ **Soft Delete** - No hard deletes, uses `deletedAt` column
✅ **Audit Logging** - All operations logged in repository
✅ **Validation** - Email, phone, file types/sizes
✅ **Error Handling** - 409 duplicates, 403 forbidden, 404 not found

---

## Database Schema

### Teachers Table

```sql
CREATE TABLE `teachers` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `tenantId` CHAR(36) NOT NULL REFERENCES tenants(id),
  `userId` CHAR(36) NOT NULL UNIQUE REFERENCES users(id),
  
  -- Personal Information
  `teacherId` VARCHAR(100) NOT NULL,
  `firstName` VARCHAR(100) NOT NULL,
  `lastName` VARCHAR(100) NOT NULL,
  `gender` ENUM('Male', 'Female', 'Other'),
  `dateOfBirth` DATE,
  `bloodGroup` VARCHAR(10),
  `maritalStatus` ENUM('Single', 'Married', 'Divorced', 'Widowed'),
  `languageKnown` JSON,
  `qualification` TEXT,
  `workExperience` TEXT,
  `fatherName` VARCHAR(255),
  `motherName` VARCHAR(255),
  `address` TEXT,
  `permanentAddress` TEXT,
  `panNumber` VARCHAR(20),
  `notes` TEXT,
  
  -- Contact Information
  `primaryContactNumber` VARCHAR(20),
  `emailAddress` VARCHAR(255),
  
  -- Employment Information
  `dateOfJoining` DATE,
  `dateOfLeaving` DATE,
  `contractType` ENUM('Permanent', 'Temporary', 'Contract', 'Probation'),
  `workShift` ENUM('Morning', 'Afternoon', 'Night'),
  `workLocation` VARCHAR(255),
  `previousSchool` VARCHAR(255),
  `previousSchoolAddress` TEXT,
  `previousSchoolPhone` VARCHAR(20),
  
  -- Academic Assignment
  `classIds` JSON,
  `subjectIds` JSON,
  
  -- Payroll
  `epfNo` VARCHAR(50),
  `basicSalary` DECIMAL(12, 2),
  
  -- Leaves
  `medicalLeaves` INT DEFAULT 0,
  `casualLeaves` INT DEFAULT 0,
  `maternityLeaves` INT DEFAULT 0,
  `sickLeaves` INT DEFAULT 0,
  
  -- Bank Details
  `accountName` VARCHAR(255),
  `accountNumber` VARCHAR(50),
  `bankName` VARCHAR(255),
  `ifscCode` VARCHAR(20),
  `branchName` VARCHAR(255),
  
  -- Transport
  `routeId` CHAR(36),
  `vehicleNumber` VARCHAR(50),
  `pickupPoint` VARCHAR(255),
  
  -- Hostel
  `hostelId` CHAR(36),
  `roomNo` VARCHAR(50),
  
  -- Social Media
  `facebookUrl` VARCHAR(255),
  `instagramUrl` VARCHAR(255),
  `linkedinUrl` VARCHAR(255),
  `youtubeUrl` VARCHAR(255),
  `twitterUrl` VARCHAR(255),
  
  -- S3 Document Keys
  `profileImageKey` VARCHAR(500),
  `resumeKey` VARCHAR(500),
  `joiningLetterKey` VARCHAR(500),
  
  -- Status & Metadata
  `status` ENUM('active', 'inactive', 'on-leave', 'suspended', 'resigned') DEFAULT 'active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  
  -- Indexes for RLS & Performance
  UNIQUE KEY `uq_tenant_teacher_id` (`tenantId`, `teacherId`),
  UNIQUE KEY `uq_tenant_user_id` (`tenantId`, `userId`),
  KEY `idx_tenant_status` (`tenantId`, `status`),
  KEY `idx_tenant_deleted` (`tenantId`, `deletedAt`),
  KEY `idx_tenant_email` (`tenantId`, `emailAddress`),
  KEY `idx_created` (`createdAt`)
);
```

---

## API Endpoints

### 1. Create Teacher (POST /api/teachers)

**Authentication:** Required (Bearer token)
**Authorization:** `admin`, `principal`
**Content-Type:** `multipart/form-data`

**Request Body:**

```javascript
// Form fields
{
  // REQUIRED
  "firstName": "John",                          // varchar(100)
  "lastName": "Doe",                            // varchar(100)
  "email": "john.doe@school.com",               // unique per tenant
  "password": "SecurePass123!",                 // min 8 chars, hashed with bcrypt
  "teacherId": "T001",                          // unique per tenant (enterprise ID)
  
  // OPTIONAL - Contact & Personal
  "phone": "+919876543210",                     // E.164 format
  "gender": "Male",                             // Male | Female | Other
  "dateOfBirth": "1990-05-15",                  // YYYY-MM-DD
  "bloodGroup": "O+",
  "maritalStatus": "Single",                    // Single | Married | Divorced | Widowed
  "languageKnown": ["English", "Hindi"],        // JSON array or stringified JSON
  "qualification": "B.Ed, M.A Physics",
  "workExperience": "10 years teaching",
  
  // Family Information
  "fatherName": "Mr. Smith",
  "motherName": "Mrs. Smith",
  "address": "123 Main St, City",
  "permanentAddress": "456 Oak Ave, State",
  "panNumber": "ABCDE1234F",
  
  // Employment Information
  "dateOfJoining": "2023-06-01",                // YYYY-MM-DD
  "dateOfLeaving": null,                        // Optional
  "contractType": "Permanent",                  // Permanent | Temporary | Contract | Probation
  "workShift": "Morning",                       // Morning | Afternoon | Night
  "workLocation": "Main Campus",
  "previousSchool": "XYZ Academy",
  "previousSchoolAddress": "Old location",
  "previousSchoolPhone": "+919876543210",
  
  // Academic Assignment
  "classIds": ["uuid-1", "uuid-2", "uuid-3"],  // JSON array of class UUIDs
  "subjectIds": ["uuid-1", "uuid-2"],           // JSON array of subject UUIDs
  
  // Payroll
  "epfNo": "EMP12345",
  "basicSalary": "50000.00",                    // Decimal(12,2)
  
  // Leaves (annual allocation)
  "medicalLeaves": 10,
  "casualLeaves": 12,
  "maternityLeaves": 180,
  "sickLeaves": 6,
  
  // Bank Details
  "accountName": "John Doe",
  "accountNumber": "1234567890",
  "bankName": "State Bank of India",
  "ifscCode": "SBIN0001234",
  "branchName": "Main Branch",
  
  // Transport
  "routeId": "uuid-route",
  "vehicleNumber": "KA-01-AB-1234",
  "pickupPoint": "Central Bus Stop",
  
  // Hostel (if applicable)
  "hostelId": "uuid-hostel",
  "roomNo": "A-101",
  
  // Social Media
  "facebookUrl": "https://facebook.com/johndoe",
  "instagramUrl": "https://instagram.com/johndoe",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "youtubeUrl": "https://youtube.com/@johndoe",
  "twitterUrl": "https://twitter.com/johndoe",
  
  // Status
  "status": "active"                            // active | inactive | on-leave | suspended | resigned
}

// Files (multipart)
// - profileImage: JPG/PNG/SVG, max 4MB
// - resume: PDF, max 4MB
// - joiningLetter: PDF, max 4MB
```

**Response (201 Created):**

```javascript
{
  "success": true,
  "message": "Teacher created successfully",
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "550e8400-e29b-41d4-a716-446655440002",
    "teacherId": "T001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@school.com",
    "phone": "+919876543210",
    // ... all other fields
    "profileImageUrl": "https://api.school.com/files/profileImageKey",
    "resumeUrl": "https://api.school.com/files/resumeKey",
    "joiningLetterUrl": "https://api.school.com/files/joiningLetterKey",
    "createdAt": "2024-01-10T10:30:00Z",
    "updatedAt": "2024-01-10T10:30:00Z"
  }
}
```

**Error Responses:**

```javascript
// 400 - Validation Error
{ "success": false, "error": "email is required", "code": "VALIDATION_ERROR" }

// 409 - Duplicate Email
{ "success": false, "error": "Email already exists for this tenant: john@school.com", "code": "DUPLICATE_EMAIL" }

// 403 - Insufficient Permissions
{ "success": false, "error": "Insufficient permissions to create teachers", "code": "FORBIDDEN" }
```

---

### 2. List Teachers (GET /api/teachers)

**Authentication:** Required
**Authorization:** `admin`, `principal`, `teacher`

**Query Parameters:**

```
GET /api/teachers?page=1&limit=20&status=active&contractType=Permanent&search=John
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Records per page (max 100) |
| `status` | string | - | Filter: active, inactive, on-leave, suspended, resigned |
| `contractType` | string | - | Filter: Permanent, Temporary, Contract, Probation |
| `search` | string | - | Search by firstName, lastName, email, teacherId |

**Response (200 OK):**

```javascript
{
  "success": true,
  "data": {
    "count": 150,                          // Total matching records
    "rows": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "tenantId": "550e8400-e29b-41d4-a716-446655440001",
        "teacherId": "T001",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@school.com",
        "status": "active",
        // ... other fields
        "createdAt": "2024-01-10T10:30:00Z"
      },
      // ... more teachers
    ],
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

### 3. Get Teacher by ID (GET /api/teachers/:id)

**Authentication:** Required
**Authorization:** `admin`, `principal`, `teacher` (RLS enforced)

**Response (200 OK):**

```javascript
{
  "success": true,
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "550e8400-e29b-41d4-a716-446655440002",
    "teacherId": "T001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@school.com",
    "phone": "+919876543210",
    "gender": "Male",
    "dateOfBirth": "1990-05-15",
    "bloodGroup": "O+",
    "maritalStatus": "Single",
    "languageKnown": ["English", "Hindi"],
    "qualification": "B.Ed, M.A Physics",
    "workExperience": "10 years teaching",
    "fatherName": "Mr. Smith",
    "motherName": "Mrs. Smith",
    "address": "123 Main St, City",
    "permanentAddress": "456 Oak Ave, State",
    "panNumber": "ABCDE1234F",
    "primaryContactNumber": "+919876543210",
    "emailAddress": "john.doe@school.com",
    "dateOfJoining": "2023-06-01",
    "dateOfLeaving": null,
    "contractType": "Permanent",
    "workShift": "Morning",
    "workLocation": "Main Campus",
    "previousSchool": "XYZ Academy",
    "previousSchoolAddress": "Old location",
    "previousSchoolPhone": "+919876543210",
    "classIds": ["uuid-1", "uuid-2"],
    "subjectIds": ["uuid-1"],
    "epfNo": "EMP12345",
    "basicSalary": "50000.00",
    "medicalLeaves": 10,
    "casualLeaves": 12,
    "maternityLeaves": 180,
    "sickLeaves": 6,
    "accountName": "John Doe",
    "accountNumber": "1234567890",
    "bankName": "State Bank of India",
    "ifscCode": "SBIN0001234",
    "branchName": "Main Branch",
    "routeId": "uuid-route",
    "vehicleNumber": "KA-01-AB-1234",
    "pickupPoint": "Central Bus Stop",
    "hostelId": null,
    "roomNo": null,
    "facebookUrl": "https://facebook.com/johndoe",
    "instagramUrl": "https://instagram.com/johndoe",
    "linkedinUrl": "https://linkedin.com/in/johndoe",
    "youtubeUrl": "https://youtube.com/@johndoe",
    "twitterUrl": "https://twitter.com/johndoe",
    "profileImageUrl": "https://api.school.com/files/profile-image-key",  // Presigned URL
    "resumeUrl": "https://api.school.com/files/resume-key",               // Presigned URL
    "joiningLetterUrl": "https://api.school.com/files/joining-letter-key", // Presigned URL
    "status": "active",
    "createdAt": "2024-01-10T10:30:00Z",
    "updatedAt": "2024-01-10T10:30:00Z"
  }
}
```

**Error Responses:**

```javascript
// 404 - Not Found
{ "success": false, "error": "Teacher not found", "code": "NOT_FOUND" }

// 403 - Forbidden (RLS denied access)
{ "success": false, "error": "Forbidden", "code": "FORBIDDEN" }
```

---

### 4. Update Teacher (PUT /api/teachers/:id)

**Authentication:** Required
**Authorization:** `admin`, `principal`, `teacher` (own record only)
**Content-Type:** `multipart/form-data`

**Request Body:** (Partial update - all fields optional)

```javascript
{
  "firstName": "Jonathan",                      // Optional
  "lastName": "Doe",                            // Optional
  "email": "jonathan.doe@school.com",           // Optional, checks for duplicates
  "phone": "+919876543210",                     // Optional
  "dateOfJoining": "2023-06-01",               // Optional
  "contractType": "Permanent",                  // Optional
  "classIds": ["uuid-1", "uuid-2", "uuid-3"],  // Optional
  "basicSalary": "55000.00",                    // Optional
  "status": "on-leave",                         // Optional
  
  // Files (optional, replaces existing)
  // - profileImage
  // - resume
  // - joiningLetter
}
```

**Response (200 OK):**

```javascript
{
  "success": true,
  "message": "Teacher updated successfully",
  "teacher": { /* complete teacher object */ }
}
```

**Error Responses:**

```javascript
// 404 - Not Found
{ "success": false, "error": "Teacher not found", "code": "NOT_FOUND" }

// 403 - Forbidden
{ "success": false, "error": "Forbidden: Cannot update other teachers", "code": "FORBIDDEN" }

// 409 - Duplicate Email
{ "success": false, "error": "Email already in use: new@school.com", "code": "DUPLICATE_EMAIL" }
```

---

### 5. Delete Teacher (DELETE /api/teachers/:id)

**Authentication:** Required
**Authorization:** `admin` only

**Response (200 OK):**

```javascript
{
  "success": true,
  "message": "Teacher deleted successfully"
}
```

**Error Responses:**

```javascript
// 404 - Not Found
{ "success": false, "error": "Teacher not found", "code": "NOT_FOUND" }

// 403 - Forbidden
{ "success": false, "error": "Insufficient permissions to delete teachers", "code": "FORBIDDEN" }
```

---

## cURL Examples

### 1. Create Teacher with Files

```bash
curl -X POST http://localhost:3000/api/teachers \
  -H "Authorization: Bearer <TOKEN>" \
  -F "firstName=John" \
  -F "lastName=Doe" \
  -F "email=john@school.com" \
  -F "password=SecurePass123!" \
  -F "teacherId=T001" \
  -F "contractType=Permanent" \
  -F "dateOfJoining=2023-06-01" \
  -F "classIds=[\"uuid-1\",\"uuid-2\"]" \
  -F "profileImage=@/path/to/image.jpg" \
  -F "resume=@/path/to/resume.pdf" \
  -F "joiningLetter=@/path/to/letter.pdf"
```

### 2. List Teachers with Filters

```bash
curl -X GET "http://localhost:3000/api/teachers?page=1&limit=20&status=active&search=John" \
  -H "Authorization: Bearer <TOKEN>"
```

### 3. Get Teacher by ID

```bash
curl -X GET http://localhost:3000/api/teachers/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <TOKEN>"
```

### 4. Update Teacher

```bash
curl -X PUT http://localhost:3000/api/teachers/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: multipart/form-data" \
  -F "firstName=Jonathan" \
  -F "status=on-leave" \
  -F "profileImage=@/path/to/new-image.jpg"
```

### 5. Delete Teacher

```bash
curl -X DELETE http://localhost:3000/api/teachers/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <TOKEN>"
```

---

## JavaScript/Fetch Examples

### Create Teacher with Files

```javascript
const formData = new FormData();
formData.append('firstName', 'John');
formData.append('lastName', 'Doe');
formData.append('email', 'john@school.com');
formData.append('password', 'SecurePass123!');
formData.append('teacherId', 'T001');
formData.append('contractType', 'Permanent');
formData.append('classIds', JSON.stringify(['uuid-1', 'uuid-2']));

// Add files
formData.append('profileImage', fileInputElement.files[0]);
formData.append('resume', fileInputElement.files[1]);
formData.append('joiningLetter', fileInputElement.files[2]);

const response = await fetch('/api/teachers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
console.log(result);
```

### List Teachers

```javascript
const response = await fetch('/api/teachers?page=1&limit=20&status=active', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();
console.log(result.data.rows);
```

### Update Teacher

```javascript
const formData = new FormData();
formData.append('firstName', 'Jonathan');
formData.append('status', 'on-leave');

const response = await fetch('/api/teachers/550e8400-e29b-41d4-a716-446655440000', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
console.log(result.teacher);
```

---

## Security Implementations

### 1. Multi-Tenant Isolation

```javascript
// Every query includes tenantId filter
const tenantFilter = {
  tenantId: userContext.tenantId,
  deletedAt: { [Op.is]: null }  // Soft delete enforcement
};
```

### 2. Row-Level Security (RLS)

```javascript
// Applied in repository layer, not controller
applyRLSFilter(where, userContext, 'read') {
  // TENANT scope: Admin sees all
  // OWNED scope: Teacher/Manager sees restricted records
  // SELF scope: User sees only own record
}
```

### 3. Password Hashing

```javascript
const passwordHash = await bcrypt.hash(password, 10);
// Stored in users table, never in teachers table
```

### 4. File Security

- Files stored in S3 with `tenants/{tenantId}/teachers/` prefix
- Only S3 keys stored in database
- Files served via presigned URLs or proxy with access control
- No publicly exposed S3 URLs

### 5. Transactions

```javascript
// Create/Update/Delete use transactions for consistency
const transaction = await sequelize.transaction();
try {
  await User.create({...}, { transaction });
  await Teacher.create({...}, { transaction });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
}
```

### 6. Input Validation

- Email format validation
- Phone number validation
- Password strength requirements (min 8 chars)
- File type and size validation
- JSON array validation for classIds, subjectIds
- Enum field validation

### 7. Duplicate Prevention

- Composite unique indexes: `(tenantId, teacherId)`, `(tenantId, userId)`, `(tenantId, emailAddress)`
- Database-level uniqueness enforcement
- Application-level checks before creation

---

## Migration Instructions

### Step 1: Load Teacher Model

```javascript
// server.js - Already done
require('./models/Teacher');
```

### Step 2: Create Database Table

```sql
-- Run this migration script
CREATE TABLE `teachers` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `tenantId` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `teacherId` VARCHAR(100) NOT NULL,
  `firstName` VARCHAR(100) NOT NULL,
  `lastName` VARCHAR(100) NOT NULL,
  `gender` ENUM('Male', 'Female', 'Other'),
  `dateOfBirth` DATE,
  `bloodGroup` VARCHAR(10),
  `maritalStatus` ENUM('Single', 'Married', 'Divorced', 'Widowed'),
  `languageKnown` JSON,
  `qualification` TEXT,
  `workExperience` TEXT,
  `fatherName` VARCHAR(255),
  `motherName` VARCHAR(255),
  `address` TEXT,
  `permanentAddress` TEXT,
  `panNumber` VARCHAR(20),
  `notes` TEXT,
  `primaryContactNumber` VARCHAR(20),
  `emailAddress` VARCHAR(255),
  `dateOfJoining` DATE,
  `dateOfLeaving` DATE,
  `contractType` ENUM('Permanent', 'Temporary', 'Contract', 'Probation'),
  `workShift` ENUM('Morning', 'Afternoon', 'Night'),
  `workLocation` VARCHAR(255),
  `previousSchool` VARCHAR(255),
  `previousSchoolAddress` TEXT,
  `previousSchoolPhone` VARCHAR(20),
  `classIds` JSON,
  `subjectIds` JSON,
  `epfNo` VARCHAR(50),
  `basicSalary` DECIMAL(12, 2),
  `medicalLeaves` INT DEFAULT 0,
  `casualLeaves` INT DEFAULT 0,
  `maternityLeaves` INT DEFAULT 0,
  `sickLeaves` INT DEFAULT 0,
  `accountName` VARCHAR(255),
  `accountNumber` VARCHAR(50),
  `bankName` VARCHAR(255),
  `ifscCode` VARCHAR(20),
  `branchName` VARCHAR(255),
  `routeId` CHAR(36),
  `vehicleNumber` VARCHAR(50),
  `pickupPoint` VARCHAR(255),
  `hostelId` CHAR(36),
  `roomNo` VARCHAR(50),
  `facebookUrl` VARCHAR(255),
  `instagramUrl` VARCHAR(255),
  `linkedinUrl` VARCHAR(255),
  `youtubeUrl` VARCHAR(255),
  `twitterUrl` VARCHAR(255),
  `profileImageKey` VARCHAR(500),
  `resumeKey` VARCHAR(500),
  `joiningLetterKey` VARCHAR(500),
  `status` ENUM('active', 'inactive', 'on-leave', 'suspended', 'resigned') DEFAULT 'active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  
  UNIQUE KEY `uq_tenant_teacher_id` (`tenantId`, `teacherId`),
  UNIQUE KEY `uq_tenant_user_id` (`tenantId`, `userId`),
  KEY `idx_tenant_status` (`tenantId`, `status`),
  KEY `idx_tenant_deleted` (`tenantId`, `deletedAt`),
  KEY `idx_tenant_email` (`tenantId`, `emailAddress`),
  KEY `idx_created` (`createdAt`),
  
  CONSTRAINT `fk_teacher_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  CONSTRAINT `fk_teacher_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Step 3: Test the API

```bash
# 1. Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"password"}'

# 2. Create a teacher
curl -X POST http://localhost:3000/api/teachers \
  -H "Authorization: Bearer <TOKEN>" \
  -F "firstName=Test" \
  -F "lastName=Teacher" \
  -F "email=test@school.com" \
  -F "password=TempPass123!" \
  -F "teacherId=T001"

# 3. List teachers
curl -X GET http://localhost:3000/api/teachers \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Error Codes Reference

| Code | Status | Meaning |
|------|--------|---------|
| `AUTH_REQUIRED` | 401 | No authentication token provided |
| `INVALID_TOKEN` | 401 | Token expired or invalid |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `DUPLICATE_EMAIL` | 409 | Email already exists in tenant |
| `DUPLICATE_TEACHER_ID` | 409 | TeacherId already exists in tenant |
| `NOT_FOUND` | 404 | Teacher record not found |
| `FORBIDDEN` | 403 | Insufficient permissions (RLS denied) |
| `FILE_SIZE_ERROR` | 413 | File exceeds max size (4MB) |
| `FILE_TYPE_ERROR` | 415 | Invalid file type |
| `S3_ERROR` | 500 | S3 upload failed |
| `DATABASE_ERROR` | 500 | Database operation failed |

---

## Performance Considerations

### Indexes

All queries use indexed columns:
- `(tenantId, status)` - Status filtering
- `(tenantId, deletedAt)` - Soft delete enforcement
- `(tenantId, emailAddress)` - Email uniqueness
- `(tenantId, teacherId)` - TeacherId lookup
- `(tenantId, userId)` - User linkage
- `createdAt` - Sorting

### Query Optimization

- Pagination limits: Default 20, max 100 records
- Lazy loading for relationships (can be added)
- Indexed search fields for global search

### Scalability

- Partitioning by tenantId (future)
- Read replicas for reporting (future)
- Caching for frequently accessed teachers (future)

---

## Testing Checklist

- [ ] Create teacher with all files
- [ ] Create teacher without optional files
- [ ] Duplicate email returns 409
- [ ] Duplicate teacherId returns 409
- [ ] Update teacher with partial data
- [ ] Update teacher files (replace existing)
- [ ] Delete teacher (soft delete)
- [ ] Verify user account is soft deleted
- [ ] Teacher cannot see other teachers' records
- [ ] Admin can see all teachers
- [ ] RLS enforcement on GET /api/teachers/:id
- [ ] Search functionality works
- [ ] File presigned URLs are generated
- [ ] Transaction rollback on error
- [ ] Pagination works correctly
- [ ] Status filtering works
- [ ] Soft deleted records are hidden

---

## Production Deployment Checklist

- [ ] Database migrations applied
- [ ] Teacher model loaded in server.js
- [ ] Routes registered in server.js
- [ ] S3 bucket configured and permissions set
- [ ] Environment variables set (AWS_REGION, S3_BUCKET, etc.)
- [ ] RBAC roles configured (admin, principal, teacher)
- [ ] File upload size limits tested
- [ ] Error handling tested
- [ ] RLS security verified
- [ ] Audit logging enabled
- [ ] API documentation updated in Swagger
- [ ] Load testing performed
