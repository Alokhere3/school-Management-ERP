# Staff Management API Documentation

## Overview

The Staff Management API provides endpoints for managing school staff members (non-teaching staff like HR, Admin, Accountants, Librarians, etc.). All endpoints are protected with RBAC (Role-Based Access Control) and require authentication.

## RBAC Access Matrix

Based on the ERP Role Access Matrix, the following roles have access to Staff Management (HR/Payroll module):

| Role | Access Level | Description |
|------|--------------|-------------|
| **Super Admin** | Full | Complete access to all staff operations |
| **School Admin** | Full | Complete access to all staff in their school |
| **HR Manager** | Full | Complete access to HR/Payroll operations |
| **Principal** | Read/Limited | Can view staff information |
| **Accountant** | Read | Can view staff for payroll purposes |
| **Teacher** | None | No access to staff management |
| **Librarian** | None | No access to staff management |
| **Transport Mgr** | None | No access to staff management |

## Endpoints

### 1. List Staff Members

**GET** `/api/staff`

List all staff members with pagination and filtering.

**Authentication:** Required  
**Authorization:** Requires `hr_payroll:read` permission

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20, max: 100) - Items per page
- `department` (string, optional) - Filter by department (Admin, Management, Academic, Library)
- `role` (string, optional) - Filter by role (Teacher, Accountant, Librarian, etc.)
- `designation` (string, optional) - Filter by designation

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@school.com",
      "role": "Accountant",
      "department": "Finance",
      "designation": "Accountant",
      "gender": "Male",
      "primaryContactNumber": "+1234567890",
      "dateOfJoining": "2024-01-15",
      "status": "active",
      "photoUrl": "http://localhost:3000/images/tenants/123/staff/photo.jpg",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "pages": 3,
    "current": 1
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad Request (missing tenantId)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)

---

### 2. Create Staff Member

**POST** `/api/staff`

Create a new staff member with optional file uploads (photo, resume, joining letter).

**Authentication:** Required  
**Authorization:** Requires `hr_payroll:create` permission

**Content-Type:** `multipart/form-data`

**Request Body (Form Data):**

**Personal Information:**
- `firstName` (string, required) - First name
- `lastName` (string, required) - Last name
- `email` (string, optional) - Email address
- `role` (string, optional) - Role (Teacher, Accountant, Librarian, etc.)
- `department` (string, optional) - Department (Admin, Management, Academic, Library)
- `designation` (string, optional) - Designation
- `gender` (enum, optional) - Male, Female, Other
- `primaryContactNumber` (string, optional) - Contact number
- `bloodGroup` (string, optional) - Blood group
- `maritalStatus` (enum, optional) - Single, Married
- `fathersName` (string, optional)
- `mothersName` (string, optional)
- `dateOfBirth` (date, optional) - YYYY-MM-DD
- `dateOfJoining` (date, optional) - YYYY-MM-DD
- `languageKnown` (array, optional) - Array of languages
- `qualification` (string, optional)
- `workExperience` (string, optional)
- `note` (string, optional)
- `address` (string, optional)
- `permanentAddress` (string, optional)

**Payroll:**
- `epfNo` (string, optional) - EPF number
- `basicSalary` (decimal, optional) - Basic salary
- `contractType` (enum, optional) - Permanent, Temporary
- `workShift` (enum, optional) - Morning, Afternoon, Night
- `workLocation` (string, optional)

**Leaves:**
- `medicalLeaves` (integer, optional, default: 0)
- `casualLeaves` (integer, optional, default: 0)
- `maternityLeaves` (integer, optional, default: 0)
- `sickLeaves` (integer, optional, default: 0)

**Bank Details:**
- `accountName` (string, optional)
- `accountNumber` (string, optional)
- `bankName` (string, optional)
- `ifscCode` (string, optional)
- `branchName` (string, optional)

**Transport:**
- `transportEnabled` (boolean, optional, default: false)
- `transportRoute` (string, optional)
- `vehicleNumber` (string, optional)
- `pickupPoint` (string, optional)

**Hostel:**
- `hostelEnabled` (boolean, optional, default: false)
- `hostelName` (string, optional)
- `roomNo` (string, optional)

**Social Media:**
- `facebookUrl` (string, optional)
- `twitterUrl` (string, optional)
- `linkedinUrl` (string, optional)
- `instagramUrl` (string, optional)

**Files:**
- `photo` (file, optional) - Staff photo (image, max 10MB)
- `resume` (file, optional) - Resume (PDF, max 10MB)
- `joiningLetter` (file, optional) - Joining letter (PDF, max 10MB)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@school.com",
    "role": "Accountant",
    "department": "Finance",
    "status": "active",
    "photoUrl": "http://localhost:3000/images/tenants/123/staff/photo.jpg",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Status Codes:**
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)

---

### 3. Get Staff Member by ID

**GET** `/api/staff/:id`

Get detailed information about a specific staff member.

**Authentication:** Required  
**Authorization:** Requires `hr_payroll:read` permission

**Path Parameters:**
- `id` (UUID, required) - Staff member ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@school.com",
    "role": "Accountant",
    "department": "Finance",
    "designation": "Accountant",
    "gender": "Male",
    "primaryContactNumber": "+1234567890",
    "dateOfBirth": "1990-05-15",
    "dateOfJoining": "2024-01-15",
    "basicSalary": 50000.00,
    "contractType": "Permanent",
    "workShift": "Morning",
    "status": "active",
    "photoUrl": "http://localhost:3000/images/tenants/123/staff/photo.jpg",
    "resumeUrl": "http://localhost:3000/images/tenants/123/staff/documents/resume.pdf",
    "joiningLetterUrl": "http://localhost:3000/images/tenants/123/staff/documents/joining-letter.pdf",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Not Found
- `401` - Unauthorized
- `403` - Forbidden

---

### 4. Update Staff Member

**PUT** `/api/staff/:id`

Update an existing staff member. All fields are optional - only provided fields will be updated.

**Authentication:** Required  
**Authorization:** Requires `hr_payroll:update` permission

**Content-Type:** `multipart/form-data`

**Path Parameters:**
- `id` (UUID, required) - Staff member ID

**Request Body:** Same as Create Staff (all fields optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe Updated",
    "email": "john.doe@school.com",
    "updatedAt": "2024-01-16T10:00:00.000Z"
  }
}
```

**Status Codes:**
- `200` - Updated
- `404` - Not Found
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden

---

### 5. Delete Staff Member

**DELETE** `/api/staff/:id`

Soft delete a staff member (sets status to 'inactive').

**Authentication:** Required  
**Authorization:** Requires `hr_payroll:delete` permission

**Path Parameters:**
- `id` (UUID, required) - Staff member ID

**Response:**
- `204` - No Content (success)
- `404` - Not Found
- `401` - Unauthorized
- `403` - Forbidden

---

## Row-Level Security (RLS)

The API implements row-level security based on permission levels:

- **Full Access:** Can view/edit all staff in the tenant
- **Limited Access:** Can only view/edit own record (if staff member has userId linked)
- **Read Access:** Can only view staff information

## File Uploads

### Supported File Types
- **Photo:** Images (JPG, PNG, GIF, SVG, WebP)
- **Resume:** PDF
- **Joining Letter:** PDF

### File Size Limit
- Maximum: 10MB per file

### Storage
Files are stored in S3 with the following structure:
```
tenants/{tenantId}/staff/{timestamp}_{filename}          # Photos
tenants/{tenantId}/staff/documents/{timestamp}_{filename} # Documents
```

### Access
Files are served through the image proxy endpoint:
```
GET /images/{key}
```

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [] // Optional: validation errors
}
```

**Common Error Codes:**
- `TENANT_REQUIRED` - Missing tenantId in token
- `VALIDATION_ERROR` - Input validation failed
- `INVALID_TOKEN` - Invalid or expired JWT token
- `INSUFFICIENT_PERMISSIONS` - User lacks required permission
- `NOT_FOUND` - Resource not found

## Examples

### Create Staff with cURL

```bash
curl -X POST http://localhost:3000/api/staff \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "firstName=John" \
  -F "lastName=Doe" \
  -F "email=john.doe@school.com" \
  -F "role=Accountant" \
  -F "department=Finance" \
  -F "designation=Accountant" \
  -F "gender=Male" \
  -F "primaryContactNumber=+1234567890" \
  -F "dateOfJoining=2024-01-15" \
  -F "basicSalary=50000" \
  -F "contractType=Permanent" \
  -F "photo=@/path/to/photo.jpg" \
  -F "resume=@/path/to/resume.pdf"
```

### List Staff with Filters

```bash
curl -X GET "http://localhost:3000/api/staff?department=Finance&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Staff

```bash
curl -X PUT http://localhost:3000/api/staff/{staff-id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "lastName=Doe Updated" \
  -F "basicSalary=55000"
```

## Notes

1. **Tenant Isolation:** All staff operations are automatically scoped to the user's tenant
2. **Soft Delete:** Deleting staff sets status to 'inactive' - records are not permanently deleted
3. **File URLs:** All file URLs are automatically converted to proxy URLs for security
4. **Input Sanitization:** All text inputs are sanitized to prevent XSS attacks
5. **Rate Limiting:** All endpoints are rate-limited (100 requests per 15 minutes per user)

