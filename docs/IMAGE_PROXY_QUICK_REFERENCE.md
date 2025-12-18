# Image Proxy - Quick Reference

## What Changed?

**Before**: Images served via raw S3 URLs or signed URLs (security risk, temporary access)  
**After**: Images served through backend proxy at `/images/:key` (secure, permanent, no expiry)

---

## For Frontend Developers

### Getting Student Images

```javascript
// GET a student
const response = await fetch('/api/students/123');
const student = response.json().data;

// Use the photoUrl directly (no expiry, no signing needed)
<img src={student.photoUrl} alt="Student" />
// Example: http://localhost:5000/images/tenants/t1/students/photo.jpg
```

**Key Point**: `photoUrl` field is now a simple HTTP URL to the backend proxy, not an S3 URL.

---

## For Backend Developers

### Proxy Route

**Endpoint**: `GET /images/:key`  
**File**: `routes/images.js`  
**Behavior**: Streams image from private S3 bucket

**Usage**:
```bash
curl http://localhost:5000/images/tenants/123/photo.jpg
```

### Helper Functions

**File**: `utils/s3Helper.js`

```javascript
const { extractKeyFromUrl, buildProxyUrl } = require('./utils/s3Helper');

// Extract S3 key from raw S3 URL
const key = extractKeyFromUrl('https://bucket.s3.us-east-1.amazonaws.com/tenants/123/photo.jpg');
// Returns: 'tenants/123/photo.jpg'

// Build proxy URL
const proxyUrl = buildProxyUrl('tenants/123/photo.jpg');
// Returns: 'http://localhost:5000/images/tenants/123/photo.jpg'
```

### Controller Pattern

All student endpoints follow this pattern:

```javascript
const student = await studentService.getStudent(id);
const key = student.photoKey;
if (key) {
    student.photoUrl = buildProxyUrl(key);  // Rebuild every request
}
res.json({ success: true, data: student });
```

---

## Database

**Student Model Fields**:
- `photoKey` (VARCHAR): S3 object key (e.g., `tenants/123/students/photo.jpg`)
- `photoUrl` (VARCHAR): Proxy URL (e.g., `http://localhost:5000/images/tenants/123/students/photo.jpg`)

**Migration**: `migrations/003_add_photoKey_to_students.js`

Apply with:
```bash
AUTO_MIGRATE=true npm run dev
```

---

## Configuration

**Required in `.env`**:
```
AWS_BUCKET=my-school-erp-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

**Optional**:
```
BACKEND_URL=http://localhost:5000    # dev
BACKEND_URL=https://api.example.com  # production
```

---

## Testing

**Test File**: `tests/controllers/studentController.test.js`

```javascript
// Mock proxy URL builder
buildProxyUrl.mockImplementation((key) => `http://localhost:5000/images/${key}`);

// Tests verify response contains proxy URLs
expect(response.photoUrl).toBe('http://localhost:5000/images/tenants/123/photo.jpg');
```

**Run Tests**:
```bash
npm test
```

✅ All 34 tests passing

---

## Comparison: Signed URLs → Proxy

| Aspect | Signed URLs | Backend Proxy |
|--------|------------|---------------|
| Frontend URL | `https://bucket.s3.amazonaws.com/...?X-Amz-Signature=...` | `http://localhost:5000/images/...` |
| Expiry | 5 minutes | No expiry |
| Refresh needed | Yes (after expiry) | No |
| S3 URL exposed | Yes | No |
| Access control | Limited | Can add custom checks |
| Complexity | Higher (signing logic) | Lower (simple HTTP proxy) |

---

## Common Tasks

### Upload Student Photo

```
POST /api/students
multipart/form-data:
  admissionNo=A123
  firstName=John
  file=<photo.jpg>

Response:
{
  "success": true,
  "data": {
    "id": "s1",
    "photoUrl": "http://localhost:5000/images/tenants/t1/students/1234567890_photo.jpg"
  }
}
```

### Display Student Photo

```html
<!-- In React, Vue, etc. -->
<img src={student.photoUrl} alt={student.firstName} />

<!-- In HTML -->
<img src="http://localhost:5000/images/tenants/t1/students/1234567890_photo.jpg" />
```

### Update Student Photo

```
PUT /api/students/s1
multipart/form-data:
  firstName=John
  file=<new-photo.jpg>

Response:
{
  "success": true,
  "data": {
    "id": "s1",
    "photoUrl": "http://localhost:5000/images/tenants/t1/students/9876543210_new_photo.jpg"
  }
}
```

---

## Troubleshooting

### Image not loading

**Check 1**: Is `photoUrl` field present?
```javascript
console.log(student.photoUrl);  // Should not be null
```

**Check 2**: Can you curl the image?
```bash
curl -v http://localhost:5000/images/tenants/123/photo.jpg
```

**Check 3**: Does `photoKey` exist in database?
```sql
SELECT id, photoKey, photoUrl FROM students WHERE id=123;
```

### 404 from /images endpoint

- Image file doesn't exist in S3
- Wrong `photoKey` in database
- S3 bucket name incorrect

### 500 from /images endpoint

- AWS credentials invalid
- S3 bucket not accessible
- Object too large to stream

Check backend logs:
```bash
npm run dev 2>&1 | grep "Image proxy"
```

---

## Security Notes

✅ S3 bucket is private (no public access)  
✅ S3 credentials stored server-side only (not in frontend)  
✅ Path traversal protection (`../` not allowed in `:key`)  
✅ Content-Type validated from S3 metadata  
✅ Cache headers prevent browser caching of sensitive images  

⚠️ Ensure IAM role has minimal permissions (GetObject only)  
⚠️ Monitor `/images` endpoint for unusual access patterns  

---

## Files Modified

- `routes/images.js` - New proxy endpoint
- `utils/s3Helper.js` - Updated helpers (removed getSignedUrl, added buildProxyUrl)
- `config/s3.js` - Export s3Client
- `controllers/studentController.js` - All GET endpoints use proxy URLs
- `server.js` - Register image routes
- `migrations/003_add_photoKey_to_students.js` - Add photoKey column
- `tests/controllers/studentController.test.js` - Updated mocks

---

## Next Steps

1. **Test locally**: `npm run dev` and try uploading a student photo
2. **Deploy to production**: Update `.env` with production AWS credentials and `BACKEND_URL`
3. **Monitor**: Watch backend logs for `/images` errors
4. **Optimize** (optional): Add CDN for image caching if traffic is high

---

## Questions?

Refer to full documentation: `docs/IMAGE_PROXY.md`
