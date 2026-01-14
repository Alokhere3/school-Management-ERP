# Teacher Management API - Implementation Guide & Examples

## Quick Start

### 1. Database Setup

Run migration to create teachers table:

```bash
npm run migrate
```

### 2. Environment Variables

Ensure `.env` contains:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=school_erp
JWT_SECRET=your-jwt-secret
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=ap-south-1
S3_BUCKET=your-private-bucket
```

### 3. Start Server

```bash
npm run dev
```

Server will run on `http://localhost:3000`

---

## API Usage Examples

### Create Teacher (POST /api/teachers)

**Using JavaScript FormData**:

```javascript
const formData = new FormData();

// Required fields
formData.append('firstName', 'John');
formData.append('lastName', 'Doe');
formData.append('email', 'john.doe@school.com');
formData.append('password', 'SecurePassword123!');
formData.append('teacherId', 'T001');

// Optional fields
formData.append('phone', '+91-9876543210');
formData.append('gender', 'Male');
formData.append('dateOfBirth', '1985-05-15');
formData.append('bloodGroup', 'O +ve');
formData.append('maritalStatus', 'Married');
formData.append('languageKnown', JSON.stringify(['English', 'Hindi']));
formData.append('qualification', 'B.A, M.Ed');
formData.append('workExperience', '10 years');
formData.append('dateOfJoining', '2024-01-15');
formData.append('contractType', 'Permanent');
formData.append('workShift', 'Morning');
formData.append('basicSalary', '50000.00');
formData.append('medicalLeaves', '12');
formData.append('casualLeaves', '6');
formData.append('accountName', 'John Doe');
formData.append('accountNumber', '123456789');
formData.append('bankName', 'HDFC Bank');
formData.append('ifscCode', 'HDFC0001234');
formData.append('classIds', JSON.stringify(['uuid-class-1', 'uuid-class-2']));
formData.append('subjectIds', JSON.stringify(['uuid-math', 'uuid-science']));

// Files (optional)
formData.append('profileImage', profileImageFile); // File from input
formData.append('resume', resumePdfFile);         // File from input
formData.append('joiningLetter', letterPdfFile);  // File from input

// Send request
const response = await fetch('http://localhost:3000/api/teachers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`
  },
  body: formData
});

const result = await response.json();
console.log('Created teacher:', result.teacher);
```

**Using cURL**:

```bash
curl -X POST http://localhost:3000/api/teachers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "firstName=John" \
  -F "lastName=Doe" \
  -F "email=john@school.com" \
  -F "password=SecurePass123!" \
  -F "teacherId=T001" \
  -F "contractType=Permanent" \
  -F "profileImage=@./profile.jpg" \
  -F "resume=@./resume.pdf"
```

**Response (201 Created)**:

```json
{
  "success": true,
  "message": "Teacher created successfully",
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "teacherId": "T001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@school.com",
    "status": "active",
    "contractType": "Permanent",
    "profileImageKey": "tenants/a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c/staff/1704893124_profile.jpg",
    "resumeKey": "tenants/a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c/staff/documents/1704893124_resume.pdf",
    "createdAt": "2024-01-10T18:45:24.548Z",
    "updatedAt": "2024-01-10T18:45:24.548Z"
  }
}
```

---

### List Teachers (GET /api/teachers)

```javascript
// List all active teachers
const response = await fetch(
  'http://localhost:3000/api/teachers?page=1&limit=20&status=active',
  {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  }
);

const { data } = await response.json();
console.log(`Found ${data.count} teachers, showing ${data.rows.length} per page`);
data.rows.forEach(teacher => {
  console.log(`${teacher.teacherId}: ${teacher.firstName} ${teacher.lastName}`);
});
```

**Search by name or ID**:

```javascript
const response = await fetch(
  'http://localhost:3000/api/teachers?search=John&page=1&limit=10',
  {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  }
);

const { data } = await response.json();
console.log('Search results:', data.rows);
```

**With filters**:

```javascript
// Get permanent teachers on morning shift
const params = new URLSearchParams({
  page: 1,
  limit: 20,
  contractType: 'Permanent'
});

const response = await fetch(
  `http://localhost:3000/api/teachers?${params}`,
  {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  }
);
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "count": 45,
    "rows": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "teacherId": "T001",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@school.com",
        "gender": "Male",
        "dateOfBirth": "1985-05-15",
        "bloodGroup": "O +ve",
        "maritalStatus": "Married",
        "status": "active",
        "contractType": "Permanent",
        "workShift": "Morning",
        "dateOfJoining": "2024-01-15",
        "basicSalary": "50000.00",
        "createdAt": "2024-01-10T18:45:24.548Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### Get Single Teacher (GET /api/teachers/:id)

```javascript
const teacherId = '550e8400-e29b-41d4-a716-446655440000';

const response = await fetch(
  `http://localhost:3000/api/teachers/${teacherId}`,
  {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  }
);

const { teacher } = await response.json();
console.log(`Loaded teacher: ${teacher.firstName} ${teacher.lastName}`);
console.log(`Profile image: ${teacher.profileImageUrl}`);
console.log(`Resume: ${teacher.resumeUrl}`);
```

**Response (200 OK)**:

```json
{
  "success": true,
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "teacherId": "T001",
    "firstName": "John",
    "lastName": "Doe",
    "gender": "Male",
    "dateOfBirth": "1985-05-15",
    "bloodGroup": "O +ve",
    "maritalStatus": "Married",
    "languageKnown": ["English", "Hindi", "Marathi"],
    "qualification": "B.A, M.Ed",
    "workExperience": "10 years in secondary education",
    "fatherName": "Ram Doe",
    "motherName": "Sita Doe",
    "address": "123 Main Street, Mumbai, 400001",
    "permanentAddress": "123 Main Street, Mumbai, 400001",
    "panNumber": "ABCDE1234F",
    "notes": "Experienced math teacher",
    "primaryContactNumber": "+91-9876543210",
    "emailAddress": "john.doe@school.com",
    "dateOfJoining": "2024-01-15",
    "dateOfLeaving": null,
    "contractType": "Permanent",
    "workShift": "Morning",
    "workLocation": "Building A",
    "previousSchool": "St. Xavier's School",
    "previousSchoolAddress": "Delhi",
    "classIds": ["uuid-class-1", "uuid-class-2"],
    "subjectIds": ["uuid-math"],
    "epfNo": "EPF123456",
    "basicSalary": "50000.00",
    "medicalLeaves": 12,
    "casualLeaves": 6,
    "maternityLeaves": 0,
    "sickLeaves": 6,
    "accountName": "John Doe",
    "accountNumber": "123456789012",
    "bankName": "HDFC Bank",
    "ifscCode": "HDFC0001234",
    "branchName": "Mumbai Main",
    "facebookUrl": "https://facebook.com/johndoe",
    "instagramUrl": "https://instagram.com/johndoe",
    "linkedinUrl": "https://linkedin.com/in/johndoe",
    "profileImageKey": "tenants/a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c/staff/profile.jpg",
    "resumeKey": "tenants/a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c/staff/documents/resume.pdf",
    "joiningLetterKey": "tenants/a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c/staff/documents/letter.pdf",
    "status": "active",
    "createdAt": "2024-01-10T18:45:24.548Z",
    "updatedAt": "2024-01-10T18:45:24.548Z"
  }
}
```

---

### Update Teacher (PUT /api/teachers/:id)

**Partial update**:

```javascript
const teacherId = '550e8400-e29b-41d4-a716-446655440000';

const formData = new FormData();
formData.append('status', 'on-leave');
formData.append('medicalLeaves', '10');
formData.append('basicSalary', '55000.00');

const response = await fetch(
  `http://localhost:3000/api/teachers/${teacherId}`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  }
);

const result = await response.json();
console.log('Teacher updated:', result.teacher);
```

**With file replacement**:

```javascript
const formData = new FormData();
formData.append('firstName', 'Jonathan');
formData.append('contractType', 'Permanent');
formData.append('basicSalary', '55000.00');
formData.append('profileImage', newProfileImageFile); // Replaces old image

const response = await fetch(
  `http://localhost:3000/api/teachers/${teacherId}`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  }
);
```

**Response (200 OK)**:

```json
{
  "success": true,
  "message": "Teacher updated successfully",
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Jonathan",
    "status": "on-leave",
    "basicSalary": "55000.00",
    "updatedAt": "2024-01-10T19:30:00.000Z"
  }
}
```

---

### Delete Teacher (DELETE /api/teachers/:id)

```javascript
const teacherId = '550e8400-e29b-41d4-a716-446655440000';

const response = await fetch(
  `http://localhost:3000/api/teachers/${teacherId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  }
);

const result = await response.json();
if (result.success) {
  console.log('Teacher deleted successfully');
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "message": "Teacher deleted successfully"
}
```

---

## RLS (Row-Level Security) Examples

### Admin Can See All Teachers

```javascript
// User with SCHOOL_ADMIN role
const response = await fetch('http://localhost:3000/api/teachers?limit=100', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
// Returns all 100 teachers in tenant
```

### Teacher Can Only See Own Profile

```javascript
// User with TEACHER role
const response = await fetch('http://localhost:3000/api/teachers/other-teacher-id', {
  headers: { 'Authorization': `Bearer ${teacherToken}` }
});
// Returns 403 FORBIDDEN
// But /api/teachers/own-id returns their own profile
```

### Principal Can See All Teachers

```javascript
// User with PRINCIPAL role
const response = await fetch('http://localhost:3000/api/teachers?limit=100', {
  headers: { 'Authorization': `Bearer ${principalToken}` }
});
// Returns all teachers they can manage
```

---

## Error Handling Examples

### Validation Error (400)

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "email must be a valid email address"
    },
    {
      "field": "password",
      "message": "password must be at least 8 characters long"
    }
  ]
}
```

### Duplicate Email (409)

```json
{
  "success": false,
  "error": "Email already exists for this tenant: john@school.com",
  "code": "DUPLICATE_EMAIL"
}
```

### Teacher Not Found (404)

```json
{
  "success": false,
  "error": "Teacher not found",
  "code": "NOT_FOUND"
}
```

### Insufficient Permissions (403)

```json
{
  "success": false,
  "error": "Insufficient permissions to create teachers",
  "code": "FORBIDDEN"
}
```

### Authentication Required (401)

```json
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

---

## Postman Collection

### Setup

1. Import into Postman
2. Set environment variables:
   - `baseUrl` = `http://localhost:3000`
   - `token` = Your JWT token
   - `tenantId` = Your tenant ID

### Requests

**Create Teacher**:
- Method: `POST`
- URL: `{{baseUrl}}/api/teachers`
- Auth: Bearer `{{token}}`
- Body: form-data with all fields

**List Teachers**:
- Method: `GET`
- URL: `{{baseUrl}}/api/teachers?page=1&limit=20`
- Auth: Bearer `{{token}}`

**Get Teacher**:
- Method: `GET`
- URL: `{{baseUrl}}/api/teachers/{id}`
- Auth: Bearer `{{token}}`

**Update Teacher**:
- Method: `PUT`
- URL: `{{baseUrl}}/api/teachers/{id}`
- Auth: Bearer `{{token}}`
- Body: form-data with partial fields

**Delete Teacher**:
- Method: `DELETE`
- URL: `{{baseUrl}}/api/teachers/{id}`
- Auth: Bearer `{{token}}`

---

## Transaction Behavior

When creating a teacher, the following operations occur in a single transaction:

1. **Validate** email, phone, files
2. **Hash** password with bcryptjs
3. **Create** User record
4. **Upload** files to S3
5. **Create** Teacher record with file keys
6. **Audit** log the creation

If ANY step fails, the **entire transaction rolls back**:

```javascript
try {
  // If file upload fails
  await s3.putObject(...);  // ❌ Fails
  // Everything rolls back - user and teacher not created
} catch (error) {
  await transaction.rollback(); // Automatic
}
```

---

## Field Validation

### Required Fields

- `firstName` (1-100 chars)
- `lastName` (1-100 chars)
- `email` (valid email format)
- `password` (min 8 characters)
- `teacherId` (1-100 chars, unique per tenant)

### Enum Fields

```javascript
gender: ['Male', 'Female', 'Other']
maritalStatus: ['Single', 'Married', 'Divorced', 'Widowed']
contractType: ['Permanent', 'Temporary', 'Contract', 'Probation']
workShift: ['Morning', 'Afternoon', 'Night']
status: ['active', 'inactive', 'on-leave', 'suspended', 'resigned']
```

### File Constraints

- **Profile Image**: JPG, PNG, SVG | Max 4MB
- **Resume**: PDF | Max 4MB
- **Joining Letter**: PDF | Max 4MB

### Numeric Fields

- `basicSalary`: Decimal (12,2) - e.g., 50000.00
- Leaves: Integer >= 0

---

## Migration from Legacy Systems

### Step 1: Bulk Create Users

```javascript
const usersData = [
  { email: 'john@school.com', phone: '+91-9876543210' },
  { email: 'jane@school.com', phone: '+91-9876543211' }
];

for (const userData of usersData) {
  const formData = new FormData();
  formData.append('firstName', userData.firstName);
  formData.append('lastName', userData.lastName);
  formData.append('email', userData.email);
  formData.append('password', 'TempPassword123!'); // Temp password
  formData.append('teacherId', userData.teacherId);
  
  const response = await fetch('http://localhost:3000/api/teachers', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: formData
  });
}
```

### Step 2: Update Records

```javascript
const updates = [
  { 
    id: 'teacher-uuid-1',
    data: { basicSalary: '50000', contractType: 'Permanent' }
  }
];

for (const { id, data } of updates) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  const response = await fetch(
    `http://localhost:3000/api/teachers/${id}`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: formData
    }
  );
}
```

---

## Testing

### Unit Tests

```javascript
describe('TeacherRepository', () => {
  it('should create teacher with user', async () => {
    const result = await teacherRepo.createTeacher(
      {
        teacherId: 'T001',
        firstName: 'John',
        lastName: 'Doe'
      },
      'SecurePassword123!',
      userContext
    );
    
    expect(result.id).toBeDefined();
    expect(result.userId).toBeDefined();
  });
  
  it('should enforce tenant isolation', async () => {
    const result = await teacherRepo.findVisibleTeachers(
      userContextTenant1,
      {},
      { page: 1, limit: 100 }
    );
    
    // Should only return teachers from tenant1
    result.rows.forEach(t => {
      expect(t.tenantId).toBe(userContextTenant1.tenantId);
    });
  });
});
```

---

## Performance Tips

1. **Pagination**: Always use `page` and `limit` for large datasets
2. **Filtering**: Use `status` and `contractType` filters to reduce results
3. **Search**: Indexed fields are `firstName`, `lastName`, `email`, `teacherId`
4. **Batch Operations**: Use bulk API for multiple creates/updates

---

## Support & Documentation

- Complete API: See [TEACHER_API.md](./TEACHER_API.md)
- RLS Details: See [RLS_IMPLEMENTATION.md](./RLS_IMPLEMENTATION.md)
- Security: See [SECURITY.md](./SECURITY.md)
- Architecture: See [ARCHITECTURAL_REFACTORING.md](./ARCHITECTURAL_REFACTORING.md)
