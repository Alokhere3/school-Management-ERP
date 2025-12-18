# School Management System - Performance & Security Analysis

## Executive Summary

This document provides a comprehensive analysis of performance and security improvements for the School ERP backend system. The analysis covers database optimization, API performance, security vulnerabilities, and best practices.

---

## 🔒 SECURITY IMPROVEMENTS

### 1. Authentication & Authorization

#### 1.1 JWT Token Security
**Current Issues:**
- JWT tokens have 24-hour expiration (too long)
- No token refresh mechanism
- No token blacklisting for logout
- JWT secret validation only at startup

**Recommendations:**
```javascript
// server.js - Add token expiration configuration
const tokenConfig = {
    accessTokenExpiry: '15m',  // Short-lived access tokens
    refreshTokenExpiry: '7d',  // Longer refresh tokens
    issuer: 'school-erp',
    audience: 'school-erp-client'
};

// Implement refresh token endpoint
// Add token blacklist/revocation mechanism
// Use Redis for token blacklist storage
```

**Action Items:**
- [ ] Implement refresh token mechanism
- [ ] Add token blacklist/revocation on logout
- [ ] Reduce access token expiry to 15 minutes
- [ ] Add token rotation on refresh
- [ ] Implement secure token storage recommendations for frontend

#### 1.2 Password Security
**Current Issues:**
- Password minimum length is only 6 characters (weak)
- No password complexity requirements
- No password history/policy enforcement
- bcrypt rounds set to 12 (acceptable but could be higher)

**Recommendations:**
```javascript
// routes/auth.js - Enhance password validation
const passwordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLength: 128
};

// Increase bcrypt rounds to 13-14 for better security
const hashedPassword = await bcrypt.hash(password, 14);

// Add password strength validation middleware
```

**Action Items:**
- [ ] Increase minimum password length to 8 characters
- [ ] Add password complexity requirements
- [ ] Implement password history (prevent reuse of last 5 passwords)
- [ ] Add password expiration policy (90 days)
- [ ] Increase bcrypt rounds to 13-14
- [ ] Add rate limiting on password reset endpoints

#### 1.3 Session Management
**Current Issues:**
- No session management beyond JWT
- No concurrent session limits
- No device tracking
- No suspicious login detection

**Recommendations:**
- Implement session tracking in database
- Add device fingerprinting
- Limit concurrent sessions per user
- Implement login anomaly detection
- Add email notifications for new device logins

### 2. Input Validation & Sanitization

#### 2.1 SQL Injection Prevention
**Current Status:** ✅ Good - Using Sequelize ORM (parameterized queries)
**Recommendations:**
- Continue using Sequelize ORM (never raw SQL with user input)
- Add input sanitization for all user inputs
- Validate all query parameters

#### 2.2 XSS (Cross-Site Scripting) Prevention
**Current Issues:**
- No input sanitization for text fields
- JSON fields (onboardingData) not sanitized
- No Content Security Policy headers

**Recommendations:**
```javascript
// Add input sanitization middleware
const sanitize = require('sanitize-html');
const validator = require('validator');

// Sanitize all text inputs
function sanitizeInput(req, res, next) {
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
}

// Add CSP headers in server.js
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));
```

**Action Items:**
- [ ] Install and configure `sanitize-html` or `dompurify`
- [ ] Add input sanitization middleware
- [ ] Sanitize JSON fields (onboardingData)
- [ ] Add Content Security Policy headers
- [ ] Validate and sanitize file uploads

#### 2.3 File Upload Security
**Current Issues:**
- File type validation only by MIME type (can be spoofed)
- No file content validation
- No virus scanning
- File size limit is 10MB (reasonable)
- Original filename used in S3 key (potential issues)

**Recommendations:**
```javascript
// config/s3.js - Enhanced file validation
const fileType = require('file-type');
const sharp = require('sharp'); // For image processing

fileFilter: async (req, file, cb) => {
    // Validate MIME type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('Invalid file type'), false);
    }
    
    // Validate actual file content (magic bytes)
    const buffer = file.buffer;
    const type = await fileType.fromBuffer(buffer);
    
    if (!type || !allowedMimes.includes(type.mime)) {
        return cb(new Error('File content does not match extension'), false);
    }
    
    // For images, validate and sanitize
    if (type.mime.startsWith('image/')) {
        try {
            await sharp(buffer).metadata(); // Validates image
        } catch (err) {
            return cb(new Error('Invalid image file'), false);
        }
    }
    
    cb(null, true);
}

// Sanitize filename
key: (req, file, cb) => {
    const tenantId = req.user?.tenantId || 'public';
    const timestamp = Date.now();
    const sanitizedName = file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .substring(0, 100);
    cb(null, `tenants/${tenantId}/students/${timestamp}_${sanitizedName}`);
}
```

**Action Items:**
- [ ] Add file content validation (magic bytes)
- [ ] Implement image processing/sanitization
- [ ] Sanitize filenames before upload
- [ ] Add virus scanning for production
- [ ] Implement file size limits per file type
- [ ] Add rate limiting on upload endpoints

### 3. API Security

#### 3.1 Rate Limiting
**Current Status:** ✅ Basic rate limiting implemented (100 requests per 15 minutes)
**Issues:**
- Global rate limit (not per-user)
- No different limits for different endpoints
- No rate limiting on auth endpoints

**Recommendations:**
```javascript
// server.js - Enhanced rate limiting
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Different limits for different routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    // Use Redis for distributed rate limiting
    store: RedisStore ? new RedisStore({ client: redisClient }) : undefined
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.user?.id || req.ip, // Per-user rate limiting
    standardHeaders: true
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    keyGenerator: (req) => req.user?.id || req.ip
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);
app.use('/api/students', upload.single('photo'), uploadLimiter);
```

**Action Items:**
- [ ] Implement per-user rate limiting
- [ ] Add stricter limits on auth endpoints (5 attempts per 15 min)
- [ ] Add rate limiting on file upload endpoints
- [ ] Use Redis for distributed rate limiting (if multiple servers)
- [ ] Add rate limit headers to responses

#### 3.2 CORS Configuration
**Current Issues:**
- Hardcoded CORS origins in server.js
- Wildcard CORS for images (`*`)
- No CORS preflight caching

**Recommendations:**
```javascript
// server.js - Environment-based CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://your-school-erp.com'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    maxAge: 86400, // 24 hours
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Action Items:**
- [ ] Move CORS origins to environment variables
- [ ] Remove wildcard CORS for images (use specific origins)
- [ ] Add CORS preflight caching
- [ ] Validate origin in production

#### 3.3 API Response Security
**Current Issues:**
- Error messages may leak sensitive information
- No response compression
- No security headers beyond Helmet defaults

**Recommendations:**
```javascript
// server.js - Add compression and security headers
const compression = require('compression');

app.use(compression()); // Gzip compression

// Enhanced Helmet configuration
app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true
}));
```

**Action Items:**
- [ ] Add response compression (gzip)
- [ ] Enhance Helmet security headers
- [ ] Sanitize error messages (don't expose stack traces)
- [ ] Add X-Request-ID header for request tracking

### 4. Data Security

#### 4.1 Sensitive Data Protection
**Current Issues:**
- Aadhar numbers stored in plain text
- Email addresses not encrypted
- Phone numbers stored in plain text
- No data encryption at rest
- No PII (Personally Identifiable Information) masking

**Recommendations:**
```javascript
// models/Student.js - Encrypt sensitive fields
const crypto = require('crypto');

// Encryption helper
function encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

// Use Sequelize hooks to encrypt/decrypt
Student.beforeSave((student) => {
    if (student.changed('aadharNumber') && student.aadharNumber) {
        student.aadharNumber = encrypt(student.aadharNumber);
    }
});

Student.afterFind((student) => {
    if (student.aadharNumber && typeof student.aadharNumber === 'object') {
        student.aadharNumber = decrypt(student.aadharNumber);
    }
});
```

**Action Items:**
- [ ] Encrypt sensitive PII (Aadhar, phone numbers)
- [ ] Implement field-level encryption
- [ ] Add data masking for logs
- [ ] Implement data retention policies
- [ ] Add GDPR compliance features (data export, deletion)

#### 4.2 Database Security
**Current Issues:**
- Database credentials in environment variables (acceptable)
- No connection encryption verification
- No database query logging for audit
- No connection pool security
- **CRITICAL:** No validation of required environment variables (DB_NAME, DB_USER, DB_PASSWORD, DB_HOST)
- Application may start with invalid database configuration

**Recommendations:**
```javascript
// config/database.js - Enhanced security
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        dialectOptions: {
            ssl: process.env.DB_SSL === 'true' ? {
                require: true,
                rejectUnauthorized: false // Set to true in production with proper cert
            } : false
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 50,
            min: 5,
            acquire: 30000,
            idle: 10000,
            evict: 10000 // Remove idle connections
        },
        // Add query timeout
        query: {
            timeout: 30000
        }
    }
);
```

**Action Items:**
- [ ] **CRITICAL:** Add environment variable validation on startup
- [ ] Enable SSL/TLS for database connections
- [ ] Add connection timeout
- [ ] Implement database audit logging
- [ ] Use read replicas for read-heavy operations
- [ ] Implement database backup encryption

**Environment Variable Validation:**
```javascript
// config/database.js - Add validation
const requiredEnvVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}
```

### 5. RBAC Security Enhancements

#### 5.1 Permission Caching
**Current Issues:**
- RBAC checks hit database on every request
- No caching of user permissions
- Multiple queries per authorization check

**Recommendations:**
```javascript
// middleware/rbac.js - Add Redis caching
const redis = require('redis');
const redisClient = redis.createClient(process.env.REDIS_URL);

async function authorize(resource, action, scope = null) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            const tenantId = req.user?.tenantId;
            
            // Cache key
            const cacheKey = `permissions:${userId}:${tenantId}:${resource}:${action}`;
            
            // Check cache first
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
            
            // ... existing permission check logic ...
            
            // Cache result for 5 minutes
            await redisClient.setex(
                cacheKey,
                300,
                JSON.stringify(req.permission)
            );
            
            next();
        } catch (error) {
            console.error('Authorization middleware error:', error);
            res.status(500).json({ message: 'Internal authorization error' });
        }
    };
}
```

**Action Items:**
- [ ] Implement Redis caching for permissions
- [ ] Cache user roles and permissions (5-10 min TTL)
- [ ] Invalidate cache on role/permission changes
- [ ] Add cache warming on server startup

#### 5.2 Row-Level Security
**Current Status:** ✅ Partially implemented
**Issues:**
- Row-level security only for students
- No RLS for other resources (attendance, fees, exams)
- Limited access checks may have race conditions

**Recommendations:**
- Extend RLS to all resources
- Add database-level RLS policies (if using PostgreSQL)
- Implement consistent RLS patterns across all controllers

### 6. Logging & Monitoring

#### 6.1 Security Event Logging
**Current Issues:**
- No security event logging
- No audit trail for sensitive operations
- No intrusion detection
- Console.log used in production code (should use logger)
- Sensitive data may be logged (user IDs, tenant IDs in console.log)

**Additional Issues Found:**
```javascript
// middleware/rbac.js:30 - Console.log in production
console.log(`🔐 Authorizing ${action} on ${resource} for user ${req}`,req.user);
// Should use: logger.debug() or logger.info()

// Missing environment variable validation
// config/database.js - No validation for DB credentials
// Should validate: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST
```

**Recommendations:**
```javascript
// utils/auditLogger.js
const logger = require('../config/logger');

function auditLog(event, userId, tenantId, details) {
    logger.info('AUDIT', {
        event,
        userId,
        tenantId,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details
    });
}

// Usage in controllers
auditLog('STUDENT_CREATED', req.user.id, req.user.tenantId, {
    studentId: student.id,
    admissionNo: student.admissionNo
});
```

**Action Items:**
- [ ] Replace all console.log/error with proper logger
- [ ] Implement comprehensive audit logging
- [ ] Log all authentication attempts (success/failure)
- [ ] Log all permission denials
- [ ] Log all data modifications (create/update/delete)
- [ ] Add security event monitoring/alerting
- [ ] Sanitize logs to prevent PII exposure
- [ ] Add environment variable validation on startup

---

## ⚡ PERFORMANCE IMPROVEMENTS

### 1. Database Optimization

#### 1.1 Indexing
**Current Status:** ✅ Basic indexes exist (tenantId, status)
**Issues:**
- Missing indexes on frequently queried fields
- No composite indexes for common query patterns
- No indexes on foreign keys

**Recommendations:**
```javascript
// models/Student.js - Add comprehensive indexes
indexes: [
    // Existing
    { name: 'compositeIndex', unique: true, fields: ['tenantId', 'admissionNo'] },
    { fields: ['tenantId', 'status'] },
    // New indexes
    { fields: ['tenantId', 'userId'] }, // For student self-access
    { fields: ['tenantId', 'teacherId'] }, // For teacher access
    { fields: ['tenantId', 'parentOf'] }, // For parent access
    { fields: ['tenantId', 'admissionClass'] }, // For class-based queries
    { fields: ['tenantId', 'onboardingCompleted'] }, // For onboarding queries
    { fields: ['createdAt'] }, // For date-based queries
    { fields: ['status', 'createdAt'] } // Composite for active students by date
]

// models/User.js - Add indexes
indexes: [
    { fields: ['email'] }, // Already unique, but ensure index
    { fields: ['tenantId', 'email'] }, // Composite for tenant-specific lookups
    { fields: ['tenantId', 'role'] } // For role-based queries
]

// models/UserRole.js - Critical indexes
indexes: [
    { fields: ['userId', 'tenantId'] }, // For user role lookups
    { fields: ['roleId'] }, // For role permission lookups
    { unique: true, fields: ['userId', 'roleId', 'tenantId'] } // Prevent duplicates
]

// models/RolePermission.js - Critical indexes
indexes: [
    { fields: ['roleId'] }, // For permission checks
    { fields: ['permissionId'] }, // For reverse lookups
    { unique: true, fields: ['roleId', 'permissionId'] } // Prevent duplicates
]
```

**Action Items:**
- [ ] Add indexes on all foreign keys
- [ ] Add composite indexes for common query patterns
- [ ] Add indexes on frequently filtered fields
- [ ] Monitor slow queries and add indexes as needed
- [ ] Use EXPLAIN to verify index usage

#### 1.2 Query Optimization
**Current Issues:**
- N+1 query problems in RBAC middleware
- No eager loading for related data
- Missing query result caching
- No query pagination limits

**Recommendations:**
```javascript
// middleware/rbac.js - Optimize permission queries
// Current: Multiple separate queries
// Optimized: Single query with joins

const rolePermissions = await RolePermission.findAll({
    where: { roleId: { [Op.in]: roleIds } },
    include: [
        {
            model: Permission,
            as: 'permission',
            where: { resource, action },
            required: true,
            attributes: ['id', 'resource', 'action'] // Only select needed fields
        }
    ],
    attributes: ['level', 'roleId'], // Only select needed fields
    raw: false
});

// services/studentService.js - Add eager loading
async function listStudents(tenantId, { page = 1, limit = 20, include = [] } = {}) {
    const offset = (page - 1) * limit;
    const maxLimit = 100; // Prevent excessive pagination
    const safeLimit = Math.min(parseInt(limit, 10) || 20, maxLimit);
    
    const { count, rows } = await Student.findAndCountAll({
        where: { tenantId, status: 'active' },
        limit: safeLimit,
        offset,
        include: include, // Allow eager loading
        attributes: { exclude: ['onboardingData'] }, // Exclude large JSON fields if not needed
        order: [['createdAt', 'DESC']] // Consistent ordering
    });
    
    return { count, rows };
}
```

**Action Items:**
- [ ] Optimize RBAC queries (reduce N+1 problems)
- [ ] Add eager loading for related data
- [ ] Implement query result caching
- [ ] Add pagination limits (max 100 per page)
- [ ] Use database views for complex queries
- [ ] Implement query result pagination with cursors

#### 1.3 Connection Pooling
**Current Status:** ✅ Connection pooling configured
**Issues:**
- Pool size may be too large for small deployments
- No connection pool monitoring
- No read replica support

**Recommendations:**
```javascript
// config/database.js - Optimize pool settings
pool: {
    max: process.env.DB_POOL_MAX || 20, // Adjust based on server capacity
    min: process.env.DB_POOL_MIN || 2,
    acquire: 30000,
    idle: 10000,
    evict: 10000,
    // Add pool monitoring
    validate: (client) => {
        return client && !client.ended;
    }
}

// Add read replica configuration
const readReplica = new Sequelize(/* read replica config */);
```

**Action Items:**
- [ ] Tune connection pool size based on load
- [ ] Add connection pool monitoring
- [ ] Implement read replicas for read-heavy operations
- [ ] Add connection health checks

### 2. API Performance

#### 2.1 Response Caching
**Current Issues:**
- No response caching
- No ETag support
- No HTTP caching headers

**Recommendations:**
```javascript
// middleware/cache.js
const redis = require('redis');
const redisClient = redis.createClient(process.env.REDIS_URL);

function cacheMiddleware(ttl = 300) {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') return next();
        
        const cacheKey = `cache:${req.originalUrl}:${req.user?.id || 'anonymous'}`;
        
        // Check cache
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            return res.json(JSON.parse(cached));
        }
        
        // Store original json method
        const originalJson = res.json.bind(res);
        res.json = function(data) {
            // Cache successful responses
            if (res.statusCode === 200) {
                redisClient.setex(cacheKey, ttl, JSON.stringify(data));
            }
            originalJson(data);
        };
        
        next();
    };
}

// Usage
router.get('/students', 
    authenticateToken, 
    authorize('students', 'read'),
    cacheMiddleware(300), // Cache for 5 minutes
    studentController.listStudents
);
```

**Action Items:**
- [ ] Implement Redis-based response caching
- [ ] Add ETag support for conditional requests
- [ ] Add HTTP caching headers (Cache-Control)
- [ ] Cache static data (roles, permissions)
- [ ] Implement cache invalidation strategies

#### 2.2 Response Compression
**Current Issues:**
- No response compression
- Large JSON responses not optimized

**Recommendations:**
```javascript
// server.js - Already recommended in security section
const compression = require('compression');

app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    level: 6 // Balance between compression and CPU
}));
```

**Action Items:**
- [ ] Add response compression (gzip/brotli)
- [ ] Configure compression level
- [ ] Exclude already compressed content

#### 2.3 Pagination Optimization
**Current Issues:**
- Basic pagination implemented
- No cursor-based pagination for large datasets
- No pagination metadata optimization

**Recommendations:**
```javascript
// services/studentService.js - Cursor-based pagination
async function listStudents(tenantId, { cursor, limit = 20 } = {}) {
    const maxLimit = 100;
    const safeLimit = Math.min(parseInt(limit, 10) || 20, maxLimit);
    
    const where = { tenantId, status: 'active' };
    
    if (cursor) {
        where.id = { [Op.gt]: cursor }; // Cursor-based pagination
    }
    
    const rows = await Student.findAll({
        where,
        limit: safeLimit + 1, // Fetch one extra to check if more exists
        order: [['id', 'ASC']],
        attributes: { exclude: ['onboardingData'] }
    });
    
    const hasMore = rows.length > safeLimit;
    const data = hasMore ? rows.slice(0, safeLimit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    
    return {
        data,
        pagination: {
            hasMore,
            nextCursor,
            limit: safeLimit
        }
    };
}
```

**Action Items:**
- [ ] Implement cursor-based pagination for large datasets
- [ ] Optimize pagination metadata
- [ ] Add pagination limits
- [ ] Implement infinite scroll support

### 3. File Upload Performance

#### 3.1 S3 Upload Optimization
**Current Issues:**
- No multipart upload for large files
- No image optimization/resizing
- No CDN integration

**Recommendations:**
```javascript
// config/s3.js - Multipart upload for large files
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.S3_BUCKET,
        key: (req, file, cb) => {
            const tenantId = req.user?.tenantId || 'public';
            const timestamp = Date.now();
            const sanitizedName = file.originalname
                .replace(/[^a-zA-Z0-9.-]/g, '_')
                .substring(0, 100);
            cb(null, `tenants/${tenantId}/students/${timestamp}_${sanitizedName}`);
        },
        // Enable multipart upload for files > 5MB
        multipartThreshold: 5 * 1024 * 1024,
        multipartChunkSize: 5 * 1024 * 1024
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: async (req, file, cb) => {
        // ... existing validation ...
        
        // Resize images before upload
        if (file.mimetype.startsWith('image/')) {
            const sharp = require('sharp');
            const buffer = await sharp(file.buffer)
                .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer();
            file.buffer = buffer;
            file.size = buffer.length;
        }
        
        cb(null, true);
    }
});
```

**Action Items:**
- [ ] Implement multipart upload for large files
- [ ] Add image optimization/resizing before upload
- [ ] Integrate CDN for image delivery
- [ ] Implement lazy loading for images
- [ ] Add image thumbnail generation

### 4. RBAC Performance

#### 4.1 Permission Check Optimization
**Current Issues:**
- Multiple database queries per request
- No permission result caching
- Sequential permission checks

**Recommendations:**
```javascript
// Already covered in Security section - Permission Caching
// Additional optimization: Batch permission checks

async function checkMultiplePermissions(user, permissions) {
    // permissions = [{ resource, action }, ...]
    const cacheKeys = permissions.map(p => 
        `permissions:${user.id}:${user.tenantId}:${p.resource}:${p.action}`
    );
    
    // Batch get from cache
    const cached = await redisClient.mget(cacheKeys);
    
    // Check which need database lookup
    const toFetch = permissions.filter((p, i) => !cached[i]);
    
    // Batch fetch from database
    // ... batch query logic ...
    
    return results;
}
```

**Action Items:**
- [ ] Implement permission result caching (see Security section)
- [ ] Batch permission checks when possible
- [ ] Preload common permissions on user login
- [ ] Use database views for permission lookups

### 5. Monitoring & Profiling

#### 5.1 Performance Monitoring
**Current Issues:**
- No performance monitoring
- No slow query logging
- No API response time tracking

**Recommendations:**
```javascript
// middleware/performance.js
function performanceMiddleware(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        // Log slow requests
        if (duration > 1000) {
            logger.warn('Slow request', {
                method: req.method,
                url: req.originalUrl,
                duration,
                userId: req.user?.id
            });
        }
        
        // Track metrics
        metrics.record('api.response_time', duration, {
            method: req.method,
            endpoint: req.route?.path,
            status: res.statusCode
        });
    });
    
    next();
}

// Add to server.js
app.use(performanceMiddleware);
```

**Action Items:**
- [ ] Implement performance monitoring middleware
- [ ] Add slow query logging
- [ ] Track API response times
- [ ] Set up APM (Application Performance Monitoring)
- [ ] Add database query performance tracking

#### 5.2 Health Checks
**Current Status:** ✅ Basic health check exists
**Issues:**
- Health check doesn't verify database connectivity
- No dependency health checks (Redis, S3)

**Recommendations:**
```javascript
// server.js - Enhanced health check
app.get('/health', async (req, res) => {
    const health = {
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        checks: {}
    };
    
    // Database check
    try {
        await sequelize.authenticate();
        health.checks.database = 'OK';
    } catch (err) {
        health.checks.database = 'FAIL';
        health.status = 'DEGRADED';
    }
    
    // Redis check
    try {
        await redisClient.ping();
        health.checks.redis = 'OK';
    } catch (err) {
        health.checks.redis = 'FAIL';
        health.status = 'DEGRADED';
    }
    
    // S3 check
    try {
        // Simple S3 connectivity check
        health.checks.s3 = 'OK';
    } catch (err) {
        health.checks.s3 = 'FAIL';
        health.status = 'DEGRADED';
    }
    
    const statusCode = health.status === 'OK' ? 200 : 503;
    res.status(statusCode).json(health);
});
```

**Action Items:**
- [ ] Enhance health check endpoint
- [ ] Add database connectivity check
- [ ] Add Redis connectivity check
- [ ] Add S3 connectivity check
- [ ] Implement readiness/liveness probes

---

## 📊 IMPLEMENTATION PRIORITY

### High Priority (Security Critical)
1. ✅ Password policy enhancement
2. ✅ JWT token security improvements
3. ✅ Input sanitization
4. ✅ Rate limiting on auth endpoints
5. ✅ File upload security
6. ✅ Permission caching

### Medium Priority (Performance Critical)
1. ✅ Database indexing
2. ✅ Query optimization
3. ✅ Response caching
4. ✅ RBAC performance optimization
5. ✅ Image optimization

### Low Priority (Nice to Have)
1. ✅ Cursor-based pagination
2. ✅ CDN integration
3. ✅ Advanced monitoring
4. ✅ Read replicas

---

## 🔧 QUICK WINS

### Immediate Actions (Can be done today)
1. **Add response compression** - 5 minutes
2. **Increase password minimum length** - 2 minutes
3. **Add pagination limits** - 10 minutes
4. **Add database indexes** - 30 minutes
5. **Implement permission caching** - 1 hour

### Short-term (This Week)
1. **Input sanitization middleware** - 2 hours
2. **Enhanced rate limiting** - 2 hours
3. **File upload security** - 3 hours
4. **Query optimization** - 4 hours

### Long-term (This Month)
1. **Comprehensive audit logging** - 1 week
2. **Performance monitoring** - 1 week
3. **CDN integration** - 3 days
4. **Read replica setup** - 2 days

---

## 📝 NOTES

- All recommendations should be tested in a staging environment before production deployment
- Monitor performance metrics before and after implementing changes
- Security improvements should be prioritized over performance optimizations
- Consider using a feature flag system for gradual rollout of changes
- Document all changes and maintain a changelog

---

## 🔗 REFERENCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Sequelize Performance](https://sequelize.org/docs/v6/other-topics/optimistic-locking/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

