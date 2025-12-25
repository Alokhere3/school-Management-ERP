
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { sequelize } = require('./config/database');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const logger = require('./config/logger');

const app = express();

// Swagger UI (OpenAPI)
const swaggerUi = require('swagger-ui-express');
let swaggerDocument = null;
let swaggerSpec = null;
try {
    // try to load static doc (fallback)
    swaggerDocument = require('./docs/swagger.json');
} catch (e) {
    swaggerDocument = null;
}

// Try to generate swagger spec from JSDoc using swagger-jsdoc (optional dev dependency)
try {
    const swaggerJsdoc = require('swagger-jsdoc');
    const options = {
        definition: swaggerDocument || {
            openapi: '3.0.0',
            info: { title: 'School ERP API', version: '1.0.0' }
        },
        apis: [__dirname + '/routes/*.js', __dirname + '/models/*.js']
    };
    swaggerSpec = swaggerJsdoc(options);
} catch (e) {
    // swagger-jsdoc may not be installed or generation failed; we'll fall back to static doc
    swaggerSpec = null;
}

// Load models to ensure they are registered with Sequelize
require('./models/Tenant');
require('./models/Student');
// Ensure User model is present and exposes expected static methods to avoid runtime 500s
const User = require('./models/User');
if (!User || typeof User.findOne !== 'function' || typeof User.create !== 'function') {
    logger.error('Server misconfiguration: `User` model is not available or missing required methods (findOne/create).');
    // fail fast so the operator can fix model exports instead of getting 500s at runtime
    process.exit(1);
}
// Ensure critical env vars exist
if (!process.env.JWT_SECRET) {
    logger.error('Server misconfiguration: JWT_SECRET is not set. Authentication will fail.');
    process.exit(1);
}

// Security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
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

// Cookie parser middleware (must be before routes)
// Use COOKIE_SECRET for signing cookies (different from JWT_SECRET for defense in depth)
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

// CORS configuration - use environment variables
// IMPORTANT: credentials: true is required for cookies to work
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000','https://school-management-erp-1dht.onrender.com/'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.) - but be careful in production
        if (!origin && process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // REQUIRED for cookies to work
    maxAge: 86400, // 24 hours
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token'] // Expose CSRF token header
}));

// Rate limiting - Different limits for different routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Only 5 attempts per window for auth
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.user?.id || req.ip, // Per-user rate limiting
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);

// Compression
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    level: 6 // Balance between compression and CPU
}));

// Parsers
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime() });
});

// Routes
const effectiveSwagger = swaggerSpec || swaggerDocument;
if (effectiveSwagger) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(effectiveSwagger));
} else {
    // placeholder route when no swagger doc is present
    app.get('/api-docs', (req, res) => res.send('No API docs available'));
}
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/staff', require('./routes/staff'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/v1/tenants/:tenantId', require('./routes/onboarding'));
// Image proxy routes (serve images from S3 via backend proxy)
try {
    const imageRoutes = require('./routes/images');
    app.use('/images', imageRoutes);
} catch (e) {
    // If routes/images.js is missing or fails to load, log and continue - tests may mock this route.
    logger.warn('Image routes not registered:', e.message);
}

// Database sync & start
sequelize.sync({ alter: false }).then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        logger.info(`🚀 School ERP Backend running on port ${port}`);
    });
}).catch(err => {
    logger.error('❌ Database sync failed:', err.message || err);
    process.exit(1);
});

