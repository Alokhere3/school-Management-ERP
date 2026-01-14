# Teacher API - Quick Reference & Postman Setup

## Quick API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/teachers` | Bearer | Create new teacher + user |
| `GET` | `/api/teachers` | Bearer | List teachers (with filters) |
| `GET` | `/api/teachers/:id` | Bearer | Get single teacher |
| `PUT` | `/api/teachers/:id` | Bearer | Update teacher (partial) |
| `DELETE` | `/api/teachers/:id` | Bearer | Soft delete teacher |

---

## Request/Response Examples

### 1. CREATE TEACHER

**Method:** `POST /api/teachers`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Body (form-data):**
```
firstName:           John
lastName:            Doe
email:               john.doe@school.com
password:            SecurePass123!
teacherId:           T001
phone:               +919876543210
gender:              Male
dateOfBirth:         1990-05-15
bloodGroup:          O+
maritalStatus:       Single
qualification:       B.Ed, M.A
workExperience:      10 years
contractType:        Permanent
dateOfJoining:       2023-06-01
workShift:           Morning
workLocation:        Main Campus
classIds:            ["uuid1", "uuid2"]
subjectIds:          ["uuid1"]
basicSalary:         50000.00
medicalLeaves:       10
casualLeaves:        12
epfNo:               EMP123
bankName:            SBI
accountNumber:       1234567890
status:              active

[File] profileImage: (binary)
[File] resume:       (binary)
[File] joiningLetter: (binary)
```

**Response:**
```json
{
  "success": true,
  "message": "Teacher created successfully",
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "tenant-uuid",
    "userId": "user-uuid",
    "teacherId": "T001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@school.com",
    "phone": "+919876543210",
    "gender": "Male",
    "dateOfBirth": "1990-05-15",
    "bloodGroup": "O+",
    "contractType": "Permanent",
    "dateOfJoining": "2023-06-01",
    "workShift": "Morning",
    "classIds": ["uuid1", "uuid2"],
    "subjectIds": ["uuid1"],
    "basicSalary": "50000.00",
    "status": "active",
    "profileImageUrl": "https://api.school.com/files/...",
    "resumeUrl": "https://api.school.com/files/...",
    "joiningLetterUrl": "https://api.school.com/files/...",
    "createdAt": "2024-01-10T10:30:00Z",
    "updatedAt": "2024-01-10T10:30:00Z"
  }
}
```

---

### 2. LIST TEACHERS

**Method:** `GET /api/teachers?page=1&limit=20&status=active`

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
page=1
limit=20
status=active (optional: active|inactive|on-leave|suspended|resigned)
contractType=Permanent (optional)
search=John (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 150,
    "rows": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "teacherId": "T001",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@school.com",
        "status": "active",
        "contractType": "Permanent",
        "dateOfJoining": "2023-06-01",
        "createdAt": "2024-01-10T10:30:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "teacherId": "T002",
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane@school.com",
        "status": "active",
        "contractType": "Permanent",
        "dateOfJoining": "2023-07-15",
        "createdAt": "2024-01-10T11:00:00Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

### 3. GET TEACHER BY ID

**Method:** `GET /api/teachers/550e8400-e29b-41d4-a716-446655440000`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "tenant-uuid",
    "userId": "user-uuid",
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
    "profileImageUrl": "https://api.school.com/files/profile-image-key",
    "resumeUrl": "https://api.school.com/files/resume-key",
    "joiningLetterUrl": "https://api.school.com/files/joining-letter-key",
    "status": "active",
    "createdAt": "2024-01-10T10:30:00Z",
    "updatedAt": "2024-01-10T10:30:00Z"
  }
}
```

---

### 4. UPDATE TEACHER

**Method:** `PUT /api/teachers/550e8400-e29b-41d4-a716-446655440000`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Body (form-data, partial):**
```
firstName:     Jonathan
status:        on-leave
basicSalary:   55000.00

[File] profileImage: (binary, optional)
```

**Response:**
```json
{
  "success": true,
  "message": "Teacher updated successfully",
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Jonathan",
    "status": "on-leave",
    "basicSalary": "55000.00",
    "updatedAt": "2024-01-10T11:30:00Z"
    // ... all other fields ...
  }
}
```

---

### 5. DELETE TEACHER

**Method:** `DELETE /api/teachers/550e8400-e29b-41d4-a716-446655440000`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Teacher deleted successfully"
}
```

---

## Status Codes Quick Reference

| Code | Status | Meaning |
|------|--------|---------|
| 201 | Created | Teacher created successfully |
| 200 | OK | Request successful |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions or RLS denied |
| 404 | Not Found | Teacher not found |
| 409 | Conflict | Duplicate email/teacherId |
| 500 | Server Error | Database or S3 error |

---

## Error Response Examples

### Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "email must be a valid email address"
    }
  ]
}
```

### Duplicate Email
```json
{
  "success": false,
  "error": "Email already exists for this tenant: john@school.com",
  "code": "DUPLICATE_EMAIL"
}
```

### Not Found
```json
{
  "success": false,
  "error": "Teacher not found",
  "code": "NOT_FOUND"
}
```

### Forbidden
```json
{
  "success": false,
  "error": "Forbidden: Cannot update other teachers",
  "code": "FORBIDDEN"
}
```

---

## Postman Collection Import

Save as `Teacher_API.postman_collection.json`:

```json
{
  "info": {
    "name": "Teacher Management API",
    "description": "Multi-tenant Teacher APIs",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Teacher",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          }
        ],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "firstName",
              "value": "John",
              "type": "text"
            },
            {
              "key": "lastName",
              "value": "Doe",
              "type": "text"
            },
            {
              "key": "email",
              "value": "john.doe@school.com",
              "type": "text"
            },
            {
              "key": "password",
              "value": "SecurePass123!",
              "type": "text"
            },
            {
              "key": "teacherId",
              "value": "T001",
              "type": "text"
            },
            {
              "key": "contractType",
              "value": "Permanent",
              "type": "text"
            },
            {
              "key": "profileImage",
              "type": "file",
              "src": []
            }
          ]
        },
        "url": {
          "raw": "{{baseUrl}}/api/teachers",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "teachers"]
        }
      }
    },
    {
      "name": "List Teachers",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/teachers?page=1&limit=20&status=active",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "teachers"],
          "query": [
            {
              "key": "page",
              "value": "1"
            },
            {
              "key": "limit",
              "value": "20"
            },
            {
              "key": "status",
              "value": "active"
            }
          ]
        }
      }
    },
    {
      "name": "Get Teacher by ID",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/teachers/{{teacherId}}",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "teachers", "{{teacherId}}"]
        }
      }
    },
    {
      "name": "Update Teacher",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          }
        ],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "firstName",
              "value": "Jonathan",
              "type": "text"
            },
            {
              "key": "status",
              "value": "on-leave",
              "type": "text"
            }
          ]
        },
        "url": {
          "raw": "{{baseUrl}}/api/teachers/{{teacherId}}",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "teachers", "{{teacherId}}"]
        }
      }
    },
    {
      "name": "Delete Teacher",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/api/teachers/{{teacherId}}",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "teachers", "{{teacherId}}"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": ""
    },
    {
      "key": "teacherId",
      "value": ""
    }
  ]
}
```

---

## JavaScript SDK Usage

```javascript
// Initialize API client
const apiUrl = 'http://localhost:3000/api/teachers';
const token = localStorage.getItem('authToken');

// Create Teacher
async function createTeacher(formData) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData  // multipart/form-data
  });
  return response.json();
}

// List Teachers
async function listTeachers(page = 1, limit = 20, filters = {}) {
  const params = new URLSearchParams({
    page,
    limit,
    ...filters
  });
  
  const response = await fetch(`${apiUrl}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

// Get Teacher
async function getTeacher(teacherId) {
  const response = await fetch(`${apiUrl}/${teacherId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

// Update Teacher
async function updateTeacher(teacherId, formData) {
  const response = await fetch(`${apiUrl}/${teacherId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  return response.json();
}

// Delete Teacher
async function deleteTeacher(teacherId) {
  const response = await fetch(`${apiUrl}/${teacherId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}
```

---

## Configuration Checklist

- [ ] Database table created
- [ ] Environment variables set (.env)
- [ ] S3 bucket configured
- [ ] AWS credentials valid
- [ ] Teacher model imported in server.js
- [ ] Teacher routes registered in server.js
- [ ] RepositoryFactory updated
- [ ] Server restarted
- [ ] Authentication working (can get token)
- [ ] Authorization roles configured (admin, principal, teacher)
- [ ] RLS enforcement verified
- [ ] File uploads tested

---

## Deployment Checklist

- [ ] Database migration applied
- [ ] All models loaded
- [ ] Routes registered
- [ ] Environment variables set in production
- [ ] S3 bucket created and configured
- [ ] IAM user has S3 access
- [ ] File upload limits configured
- [ ] CORS configured for frontend domain
- [ ] Rate limiting enabled
- [ ] Error logging enabled
- [ ] Audit logging enabled
- [ ] Backup strategy in place

---

## Support Resources

- Full API documentation: [TEACHER_API.md](./TEACHER_API.md)
- Implementation guide: [TEACHER_IMPLEMENTATION.md](./TEACHER_IMPLEMENTATION.md)
- Architecture reference: [RLS_IMPLEMENTATION.md](./RLS_IMPLEMENTATION.md)
- Security best practices: [SECURITY.md](./SECURITY.md)
