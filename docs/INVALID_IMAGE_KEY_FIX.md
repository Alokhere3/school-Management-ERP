# 🔧 Invalid Image Key Error - Fixed

## Problem

You were getting:
```
Invalid image key
```

When trying to access:
```
/images/tenants/28806b65-f28f-4d2e-91fd-7c2681d1e94f/students/1764453349796_prashant.avif
```

## Root Cause

The regex pattern `/(.+)/` was capturing a **leading slash** (the first character after `/images/`), which made the validation reject it as invalid:

```
Request URL: /images/tenants/123/photo.jpg
             ┌─────────────┬──────────────────────┐
             │   /images   │     captured         │
             └─────────────┴──────────────────────┘
             
req.params[0] = "/tenants/123/photo.jpg"  ← Starts with slash!
                ↑
Validation: key.startsWith('/') → TRUE → "Invalid image key" ❌
```

## Solution

Added two fixes:

### 1. Trim Leading Slashes
```javascript
let key = req.params[0];
key = key.replace(/^\/+/, '');  // Remove leading slashes
// "/tenants/123/photo.jpg" → "tenants/123/photo.jpg" ✓
```

### 2. Relaxed Validation
```javascript
// OLD: Rejected keys starting with '/'
if (!key || key.includes('..') || key.startsWith('/')) {
    return res.status(400).json({ message: 'Invalid image key' });
}

// NEW: Only rejects dangerous patterns
if (!key || key.includes('..')) {
    return res.status(400).json({ message: 'Invalid image key' });
}
```

### 3. Added Logging
```javascript
console.log('Image proxy request for key:', key);
console.error('Image proxy error for key', key, ':', err.message);
```

This helps debug issues in the future.

## What Changed

**File**: `routes/images.js`

```javascript
// BEFORE
router.get(/(.+)/, async (req, res) => {
    const key = req.params[0];
    if (!key || key.includes('..') || key.startsWith('/')) {  // ❌ Rejects valid paths
        return res.status(400).json({ message: 'Invalid image key' });
    }
    // ... rest of code
});

// AFTER
router.get(/(.+)/, async (req, res) => {
    let key = req.params[0];
    key = key.replace(/^\/+/, '');  // ✅ Remove leading slashes
    
    if (!key || key.includes('..')) {  // ✅ Only reject dangerous patterns
        return res.status(400).json({ message: 'Invalid image key' });
    }
    
    console.log('Image proxy request for key:', key);  // ✅ Added logging
    // ... rest of code
});
```

## How It Works Now

```
Request: GET /images/tenants/123/students/photo.jpg

Step 1: Regex captures
  req.params[0] = "/tenants/123/students/photo.jpg"

Step 2: Trim leading slashes
  key = "tenants/123/students/photo.jpg" ✓

Step 3: Validate
  ✓ key is not empty
  ✓ key doesn't contain ".."
  ✓ Valid!

Step 4: Send to S3
  GetObjectCommand {
    Bucket: "school-erp-files-prod",
    Key: "tenants/123/students/photo.jpg"
  }

Step 5: Stream response
  ✓ Image returned to browser
```

## Security Still Protected

The fix still prevents path traversal attacks:

```
✅ BLOCKED: /images/../../../etc/passwd
   After trim: /../../../etc/passwd
   Check: includes('..') → TRUE → Blocked ✓

✅ BLOCKED: /images/../../secret.txt
   After trim: /../../secret.txt
   Check: includes('..') → TRUE → Blocked ✓

✅ ALLOWED: /images/tenants/123/students/photo.jpg
   After trim: tenants/123/students/photo.jpg
   Check: no dangerous patterns → Allowed ✓
```

## Test Results

✅ **All 34 tests passing**
```
Test Suites: 5 passed, 5 total
Tests:       34 passed, 34 total
```

## Verification

### 1. Start Server
```bash
npm run dev
```

Expected output:
```
✅ MySQL Connected
🚀 School ERP Backend running on port 3000
```

### 2. Make a Test Request

Try your actual image URL:
```bash
curl -v http://localhost:3000/images/tenants/28806b65-f28f-4d2e-91fd-7c2681d1e94f/students/1764453349796_prashant.avif
```

Expected response:
```
< HTTP/1.1 200 OK
< Content-Type: image/avif
< Cache-Control: no-cache, no-store, must-revalidate

[Binary image data...]
```

**NOT**: `{ "message": "Invalid image key" }`

### 3. Check Server Logs

You should see:
```
Image proxy request for key: tenants/28806b65-f28f-4d2e-91fd-7c2681d1e94f/students/1764453349796_prashant.avif
```

If there's an error:
```
Image proxy error for key tenants/... : NoSuchKey
```
(This means the file doesn't exist in S3, not a validation error)

## Debugging Tips

### If Still Getting "Invalid image key"

Check server logs:
```bash
npm run dev 2>&1 | grep "Invalid image key"
```

If you see it, the key is being rejected. Common causes:
1. Key is empty (unlikely)
2. Key contains `..` (path traversal attempt)

### If Getting 404

The route is working, but the file doesn't exist in S3:

```bash
# List files in S3
aws s3 ls s3://school-erp-files-prod/tenants/ --recursive | grep prashant

# Check database
curl http://localhost:3000/api/students | grep -i prashant
```

### If Getting 500

S3 error. Check logs:
```
Image proxy error for key tenants/... : AccessDenied
```

Common causes:
- AWS credentials invalid
- S3 bucket name wrong
- IAM permissions missing

## Files Changed

✅ `routes/images.js` - Fixed validation and added logging

## How to Fix Your Images Now

1. **Stop current server** (Ctrl+C)
2. **Pull latest changes** to get this fix
3. **Start server again**: `npm run dev`
4. **Re-upload photos** (or existing photos should work now)
5. **Test image loads** in your frontend

## Edge Cases Handled

```
URL: /images/tenants/123/photo.jpg
Captured: /tenants/123/photo.jpg
Trimmed: tenants/123/photo.jpg ✓

URL: /images//tenants/123/photo.jpg (double slash)
Captured: //tenants/123/photo.jpg
Trimmed: tenants/123/photo.jpg ✓

URL: /images/tenants/123//photo.jpg (double slash in middle)
Captured: /tenants/123//photo.jpg
Trimmed: tenants/123//photo.jpg ✓ (S3 handles this)
```

## Summary

```
┌──────────────────────────────────────────┐
│ BEFORE: Invalid image key error ❌       │
│ AFTER:  Images load correctly ✅        │
│                                          │
│ Fix: Trim leading slashes + relax check  │
│ Tests: 34/34 passing ✓                  │
│ Logging: Added for debugging ✓           │
└──────────────────────────────────────────┘
```

## Status

✅ **FIXED - Image validation now accepts nested paths**

Your images should now be accessible! 🎉

---

**What to do next**:
1. Start your server: `npm run dev`
2. Try accessing an image: Check server logs for "Image proxy request for key"
3. If you see that log, the route is working!
4. If image still doesn't load, check S3 bucket has the file
