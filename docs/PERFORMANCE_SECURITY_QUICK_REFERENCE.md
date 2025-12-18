# Performance & Security - Quick Reference

## 🚨 Critical Security Issues (Fix Immediately)

### 1. Password Policy (5 min fix)
```javascript
// routes/auth.js - Line 136
// Change from: password.length < 6
// Change to: password.length < 8
if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters' 
    });
}
```

### 2. JWT Token Expiry (2 min fix)
```javascript
// routes/auth.js - Line 283, 424
// Change from: expiresIn: '24h'
// Change to: expiresIn: '15m' (access token)
const token = jwt.sign({
    id: user.id,
    tenantId: tenant.id,
    role: 'admin'
}, process.env.JWT_SECRET, { expiresIn: '15m' });
```

### 3. Auth Rate Limiting (10 min fix)
```javascript
// server.js - Add after line 64
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Only 5 attempts per 15 minutes
    message: 'Too many login attempts, please try again later'
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### 4. Input Sanitization (30 min fix)
```bash
npm install sanitize-html
```
```javascript
// middleware/validation.js - Replace placeholder
const sanitize = require('sanitize-html');

module.exports = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitize(req.body[key], {
                    allowedTags: [],
                    allowedAttributes: {}
                });
            }
        });
    }
    next();
};
```

### 5. Replace Console.log with Logger (10 min fix)
```javascript
// middleware/rbac.js - Line 30, 116
// Replace console.log/error with logger
const logger = require('../config/logger');

// Line 30: Change from console.log
logger.debug(`Authorizing ${action} on ${resource} for user ${req.user?.id}`);

// Line 116: Change from console.error
logger.error('Authorization middleware error:', error);
```

### 6. Environment Variable Validation (5 min fix)
```javascript
// config/database.js - Add after line 3
const logger = require('./logger');

const requiredEnvVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}
```

### 7. CORS Configuration (5 min fix)
```javascript
// server.js - Line 58-61
// Move to environment variable
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```

---

## ⚡ Quick Performance Wins

### 1. Response Compression (2 min fix)
```bash
npm install compression
```
```javascript
// server.js - Add after line 11
const compression = require('compression');
app.use(compression());
```

### 2. Database Indexes (30 min fix)
```javascript
// models/Student.js - Add to indexes array (line 116)
indexes: [
    { name: 'compositeIndex', unique: true, fields: ['tenantId', 'admissionNo'] },
    { fields: ['tenantId', 'status'] },
    // ADD THESE:
    { fields: ['tenantId', 'userId'] },
    { fields: ['tenantId', 'teacherId'] },
    { fields: ['tenantId', 'parentOf'] },
    { fields: ['tenantId', 'admissionClass'] }
]
```

### 3. Pagination Limits (5 min fix)
```javascript
// services/studentService.js - Line 3
async function listStudents(tenantId, { page = 1, limit = 20 } = {}) {
    const maxLimit = 100; // ADD THIS
    const safeLimit = Math.min(parseInt(limit, 10) || 20, maxLimit); // ADD THIS
    const offset = (page - 1) * safeLimit; // CHANGE THIS
    
    const { count, rows } = await Student.findAndCountAll({
        where: { tenantId, status: 'active' },
        limit: safeLimit, // CHANGE THIS
        offset
    });
    // ...
}
```

### 4. Permission Caching (1 hour fix)
```bash
npm install redis
```
```javascript
// middleware/rbac.js - Add at top
const redis = require('redis');
const redisClient = redis.createClient(process.env.REDIS_URL || 'redis://localhost:6379');

// In authorize function, before database query (line 41):
const cacheKey = `permissions:${userId}:${tenantId}:${resource}:${action}`;
const cached = await redisClient.get(cacheKey);
if (cached) {
    const permission = JSON.parse(cached);
    if (permission.level === 'none') {
        return res.status(403).json({
            message: `Forbidden: No ${action} permission on ${resource}`
        });
    }
    req.permission = permission;
    return next();
}

// After permission check (line 113, before next()):
await redisClient.setex(cacheKey, 300, JSON.stringify(req.permission));
```

---

## 📋 Checklist

### Security
- [ ] Increase password minimum length to 8
- [ ] Reduce JWT token expiry to 15 minutes
- [ ] Add rate limiting on auth endpoints (5 attempts/15 min)
- [ ] Implement input sanitization
- [ ] Replace console.log with logger
- [ ] Add environment variable validation
- [ ] Fix CORS configuration
- [ ] Add file content validation
- [ ] Encrypt sensitive PII (Aadhar, phone numbers)
- [ ] Add security headers (CSP, HSTS, etc.)
- [ ] Implement audit logging
- [ ] Add permission caching

### Performance
- [ ] Add response compression
- [ ] Add database indexes
- [ ] Add pagination limits
- [ ] Optimize RBAC queries
- [ ] Implement response caching
- [ ] Add image optimization
- [ ] Implement query result caching
- [ ] Add performance monitoring
- [ ] Optimize file uploads
- [ ] Add connection pool tuning

---

## 🔍 Code Locations

### Security Issues
- Password validation: `routes/auth.js:136`
- JWT expiry: `routes/auth.js:283, 424`
- Rate limiting: `server.js:64-68`
- CORS: `server.js:58-61`
- Input validation: `middleware/validation.js` (placeholder)
- File upload: `config/s3.js:52-59`

### Performance Issues
- Database indexes: `models/Student.js:116-119`
- Pagination: `services/studentService.js:3-10`
- RBAC queries: `middleware/rbac.js:51-79`
- Response caching: Not implemented
- Compression: Not implemented

---

## 📊 Impact Assessment

### High Impact, Low Effort
1. ✅ Response compression (2 min, 30-50% size reduction)
2. ✅ Password policy (5 min, prevents weak passwords)
3. ✅ Auth rate limiting (10 min, prevents brute force)
4. ✅ Pagination limits (5 min, prevents DoS)

### High Impact, Medium Effort
1. ✅ Permission caching (1 hour, 80% reduction in DB queries)
2. ✅ Database indexes (30 min, 10-100x query speedup)
3. ✅ Input sanitization (30 min, prevents XSS)

### Medium Impact, High Effort
1. ✅ Comprehensive audit logging (1 week)
2. ✅ Performance monitoring (1 week)
3. ✅ CDN integration (3 days)

---

## 🚀 Deployment Order

1. **Week 1: Critical Security**
   - Password policy
   - JWT token expiry
   - Auth rate limiting
   - Input sanitization
   - CORS fix

2. **Week 2: Quick Performance Wins**
   - Response compression
   - Database indexes
   - Pagination limits
   - Permission caching

3. **Week 3-4: Advanced Optimizations**
   - Query optimization
   - Response caching
   - Image optimization
   - Performance monitoring

---

## 📞 Support

For detailed explanations, see:
- `docs/PERFORMANCE_AND_SECURITY_ANALYSIS.md` - Full analysis
- `docs/SECURITY.md` - Existing security documentation

