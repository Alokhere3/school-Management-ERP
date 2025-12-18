# Cookie-Based Authentication Security Guide

## Overview

The authentication system has been updated to use secure HTTP-only cookies instead of storing JWT tokens in localStorage or sending them in Authorization headers. This provides better protection against various attacks including XSS, CSRF, and token theft.

## Security Features

### 1. HTTP-Only Cookies
- **Protection**: Prevents JavaScript access to cookies (XSS protection)
- **Implementation**: All authentication cookies are set with `httpOnly: true`
- **Benefit**: Even if an attacker injects malicious JavaScript, they cannot steal the token

### 2. Secure Flag
- **Protection**: Ensures cookies are only sent over HTTPS in production
- **Implementation**: `secure: true` in production, configurable via `COOKIE_SECURE` env var
- **Benefit**: Prevents token transmission over unencrypted connections

### 3. SameSite Attribute
- **Protection**: CSRF (Cross-Site Request Forgery) protection
- **Implementation**: `sameSite: 'strict'` - cookies only sent with same-site requests
- **Benefit**: Prevents attackers from making authenticated requests from other domains

### 4. Refresh Token Pattern
- **Access Token**: Short-lived (15 minutes) - stored in `accessToken` cookie
- **Refresh Token**: Long-lived (7 days) - stored in `refreshToken` cookie
- **Benefit**: Reduces exposure window if access token is compromised

### 5. Token Rotation (Optional)
- **Feature**: Refresh tokens can be rotated on each use
- **Configuration**: Set `ROTATE_REFRESH_TOKEN=true` in environment
- **Benefit**: Limits damage if refresh token is stolen

## Cookie Configuration

### Environment Variables

```bash
# Cookie signing secret (optional, falls back to JWT_SECRET)
COOKIE_SECRET=your-cookie-secret-here

# Force secure cookies even in development (optional)
COOKIE_SECURE=true

# Cookie domain (optional, for subdomain sharing)
COOKIE_DOMAIN=.yourdomain.com

# Enable refresh token rotation (optional, default: true)
ROTATE_REFRESH_TOKEN=true
```

### Cookie Settings

**Access Token Cookie:**
- Name: `accessToken`
- Expiry: 15 minutes
- HttpOnly: Yes
- Secure: Yes (production)
- SameSite: Strict

**Refresh Token Cookie:**
- Name: `refreshToken`
- Expiry: 7 days
- HttpOnly: Yes
- Secure: Yes (production)
- SameSite: Strict

## API Endpoints

### Login
**POST** `/api/auth/login`

Sets both `accessToken` and `refreshToken` cookies. Also returns token in response body for backward compatibility.

**Response:**
```json
{
  "success": true,
  "token": "jwt-access-token", // Backward compatibility
  "tenantId": "uuid",
  "user": { ... }
}
```

### Register
**POST** `/api/auth/register`

Sets both `accessToken` and `refreshToken` cookies after successful registration.

### Refresh Token
**POST** `/api/auth/refresh`

Uses the `refreshToken` cookie to generate a new `accessToken`. Optionally rotates the refresh token.

**Response:**
```json
{
  "success": true,
  "token": "new-jwt-access-token",
  "user": { ... }
}
```

**Error Responses:**
- `401` - Refresh token expired or invalid
- `401` - User not found

### Logout
**POST** `/api/auth/logout`

Clears both `accessToken` and `refreshToken` cookies.

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

## Backward Compatibility

The system maintains backward compatibility with clients that use Authorization headers:

1. **Token Reading Priority:**
   - First: Check for `accessToken` cookie (preferred)
   - Second: Check `Authorization: Bearer <token>` header (fallback)

2. **Token Response:**
   - Tokens are still returned in JSON response body for clients that don't use cookies
   - Clients should prefer using cookies for better security

## Frontend Integration

### Using Cookies (Recommended)

```javascript
// Login - cookies are automatically set by the browser
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include', // REQUIRED for cookies
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email, password })
});

// Subsequent requests - cookies are automatically sent
const data = await fetch('/api/students', {
  credentials: 'include' // REQUIRED for cookies
});
```

### Using Authorization Header (Backward Compatibility)

```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { token } = await response.json();

// Subsequent requests
const data = await fetch('/api/students', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Refresh Token Flow

```javascript
// When access token expires (401 response)
async function refreshToken() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Sends refreshToken cookie
  });
  
  if (response.ok) {
    const { token } = await response.json();
    // New access token is in cookie, but also returned for compatibility
    return token;
  } else {
    // Refresh token expired - redirect to login
    window.location.href = '/login';
  }
}
```

## Security Best Practices

### 1. CORS Configuration
- Always set `credentials: true` in CORS configuration
- Whitelist specific origins (never use `*` with credentials)
- Use environment variables for allowed origins

### 2. HTTPS in Production
- Always use HTTPS in production
- Set `COOKIE_SECURE=true` in production
- Use HSTS headers (already configured via Helmet)

### 3. Token Expiry
- Access tokens: 15 minutes (short-lived)
- Refresh tokens: 7 days (long-lived)
- Consider implementing token blacklist for logout

### 4. CSRF Protection
- `sameSite: 'strict'` provides good CSRF protection
- For additional protection, consider CSRF tokens for state-changing operations
- Use `X-CSRF-Token` header if implementing CSRF tokens

### 5. Environment Variables
- Use different secrets for JWT and cookies (`COOKIE_SECRET` vs `JWT_SECRET`)
- Never commit secrets to version control
- Rotate secrets periodically

## Attack Prevention

### XSS (Cross-Site Scripting)
- ✅ **Protected**: HTTP-only cookies cannot be accessed by JavaScript
- ✅ **Additional**: Input sanitization middleware prevents XSS in user input

### CSRF (Cross-Site Request Forgery)
- ✅ **Protected**: `sameSite: 'strict'` prevents cross-site cookie sending
- ✅ **Additional**: CORS origin validation

### Token Theft
- ✅ **Protected**: Tokens not accessible via JavaScript
- ✅ **Additional**: Short-lived access tokens limit exposure window
- ✅ **Additional**: Refresh token rotation (optional)

### Man-in-the-Middle
- ✅ **Protected**: Secure flag ensures HTTPS-only transmission
- ✅ **Additional**: HSTS headers prevent downgrade attacks

## Migration Guide

### For Existing Clients

1. **Update CORS Configuration:**
   ```javascript
   // Frontend
   fetch(url, {
     credentials: 'include' // Add this to all requests
   });
   ```

2. **Remove Token Storage:**
   ```javascript
   // OLD: localStorage.setItem('token', token);
   // NEW: Token is automatically in cookie, no storage needed
   ```

3. **Update Token Refresh:**
   ```javascript
   // OLD: Check localStorage for token
   // NEW: Call /api/auth/refresh endpoint (cookie is sent automatically)
   ```

4. **Update Logout:**
   ```javascript
   // OLD: localStorage.removeItem('token');
   // NEW: Call /api/auth/logout (cookies are cleared server-side)
   ```

## Testing

### Manual Testing

```bash
# Login (cookies are set automatically)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"password"}'

# Use cookies in subsequent requests
curl -X GET http://localhost:3000/api/students \
  -b cookies.txt

# Refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt \
  -c cookies.txt

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

### Postman Testing

1. Enable "Send cookies" in Postman settings
2. Login request will automatically store cookies
3. Subsequent requests will automatically include cookies
4. Use "Manage Cookies" to view/clear cookies

## Troubleshooting

### Cookies Not Being Sent

**Issue**: Cookies not included in requests

**Solutions**:
- Ensure `credentials: 'include'` in fetch/axios requests
- Check CORS configuration has `credentials: true`
- Verify cookie domain matches request origin
- Check browser console for cookie-related errors

### CORS Errors

**Issue**: CORS preflight fails

**Solutions**:
- Ensure `credentials: true` in CORS config
- Whitelist your frontend origin in `ALLOWED_ORIGINS`
- Check `Access-Control-Allow-Credentials` header is present

### Token Expired Errors

**Issue**: Access token expires frequently

**Solutions**:
- Implement automatic token refresh on 401 responses
- Use refresh token endpoint before access token expires
- Consider increasing access token expiry (not recommended for security)

## Additional Resources

- [OWASP Cookie Security](https://owasp.org/www-community/HttpOnly)
- [MDN SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

