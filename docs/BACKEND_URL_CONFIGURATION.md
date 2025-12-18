# Backend URL Configuration Guide

## Problem Fixed

The image proxy was generating URLs with port 5000 instead of the actual port your app is listening on (3000 by default).

## Solution

The `buildProxyUrl()` function now **automatically detects** the correct port:

### Development (Default)

If `BACKEND_URL` is NOT set in `.env`, the system uses:

```
http://localhost:{PORT}
```

Where `{PORT}` comes from:
1. `process.env.PORT` (if set in .env)
2. Otherwise defaults to **3000**

### Example `.env` Configuration

```bash
# Minimum required for development (uses auto-detection)
NODE_ENV=development
PORT=3000
AWS_BUCKET=my-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Image URLs will be: http://localhost:3000/images/...
```

### Production Configuration

For production, explicitly set `BACKEND_URL`:

```bash
NODE_ENV=production
PORT=3000
AWS_BUCKET=my-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BACKEND_URL=https://api.school-erp.com

# Image URLs will be: https://api.school-erp.com/images/...
```

## How It Works

```javascript
// In utils/s3Helper.js
function buildProxyUrl(key) {
    if (!key) return null;
    
    let baseUrl;
    
    if (process.env.BACKEND_URL) {
        // Production: use explicit URL
        baseUrl = process.env.BACKEND_URL;
    } else {
        // Development: construct from PORT
        const port = process.env.PORT || 3000;
        baseUrl = `http://localhost:${port}`;
    }
    
    return `${baseUrl}/images/${key}`;
}
```

## Test Results

✅ All 34 tests passing with correct port detection

## Migration Guide

### If You Previously Set BACKEND_URL

**No changes needed!** Your existing configuration will continue to work.

```bash
# Still works
BACKEND_URL=http://localhost:5000
# Image URLs: http://localhost:5000/images/...

# Or set to production domain
BACKEND_URL=https://api.example.com
# Image URLs: https://api.example.com/images/...
```

### If You Don't Have BACKEND_URL Set

Great! The system will **automatically use your PORT**:

```bash
# Default behavior (auto-detects port)
PORT=3000
# OR
PORT=8080
# OR any other port

# Image URLs automatically use: http://localhost:{YOUR_PORT}/images/...
```

## Port Configuration Options

### Option 1: Use Default (Recommended for Dev)

```bash
# .env
NODE_ENV=development
# PORT not set, defaults to 3000
# Image URLs: http://localhost:3000/images/...
```

### Option 2: Explicit Port in .env

```bash
# .env
NODE_ENV=development
PORT=8080
# Image URLs: http://localhost:8080/images/...
```

### Option 3: Explicit Backend URL (Recommended for Production)

```bash
# .env
NODE_ENV=production
BACKEND_URL=https://api.school-erp.com
# Image URLs: https://api.school-erp.com/images/...
```

## Verification

Test that image URLs are correct:

```bash
# Start your server
npm run dev

# In another terminal, test the API
curl http://localhost:3000/api/students

# Check the photoUrl in the response
# Should be: http://localhost:3000/images/tenants/...
# NOT: http://localhost:5000/images/tenants/...
```

## Summary

✅ **Development**: No BACKEND_URL needed, uses `http://localhost:{PORT}`  
✅ **Production**: Set BACKEND_URL to your domain  
✅ **Automatic**: PORT detection works out of the box  
✅ **Backward Compatible**: Old BACKEND_URL settings still work  

**No breaking changes!** Your app will now generate the correct image URLs regardless of port.
