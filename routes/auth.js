const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { authenticateToken } = require('../middleware/auth');
const { getAllowedAccess, getUserPrimaryRole } = require('../utils/authorizationHelper');
const { checkPermission } = require('../middleware/rbac');
const userController = require('../controllers/userController');
const { sendError } = require('../utils/errorMapper');
const Role = require('../models/Role');
const RolePermission = require('../models/RolePermission');
const Permission = require('../models/Permission');
const { 
    setAccessTokenCookie, 
    setRefreshTokenCookie, 
    clearAuthCookies,
    getRefreshTokenFromRequest 
} = require('../utils/cookieHelper');

const router = express.Router();

// Debug: log what the User export looks like at module load to help diagnose runtime issues
try {
    console.debug('Auth route: User is', typeof User, Object.keys(User || {}));
} catch (e) {
    console.debug('Auth route: unable to introspect User export', e && e.message);
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register tenant and admin
 *     description: Create a new tenant with an admin user. If roles parameter is provided, authentication is required and user must have 'create' permission on 'roles' resource. Note: Only Super Admin can assign 'School Admin' role to users.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tenant name
 *               email:
 *                 type: string
 *                 description: Admin user email
 *               password:
 *                 type: string
 *                 description: Admin user password (min 6 characters)
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of role names to assign to the admin user (e.g., ["Super Admin"], ["School Admin", "Principal"]). Requires authentication and 'create' permission on 'roles' resource. IMPORTANT: Only Super Admin can assign 'School Admin' role.
 *                 example: ["School Admin"]
 *             required:
 *               - name
 *               - email
 *               - password
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 tenantId:
 *                   type: string
 *                   description: Tenant id of the newly created tenant (top-level for convenience)
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     tenantId:
 *                       type: string
 *                     role:
 *                       type: string
 *                     allowedAccess:
 *                       type: object
 *                 roles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
 *                   description: Assigned roles for the admin user, or available roles if no roles were assigned
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - authentication required when assigning roles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - user lacks permission to assign roles, or attempting to assign 'School Admin' role without Super Admin privileges
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict - duplicate value (e.g. email already registered)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// POST /api/auth/register
router.post('/register', require('../middleware/validation'), async (req, res) => {
    const logger = require('../config/logger');
    try {
        const { name, email, password, roles } = req.body || {};

        // Basic validation so UI can show clear messages
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Tenant name is required' });
        }
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'A valid email is required' });
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password is required and must be at least 8 characters' });
        }

        // Validate roles if provided
        if (roles !== undefined && (!Array.isArray(roles) || roles.length === 0)) {
            return res.status(400).json({ success: false, error: 'Roles must be a non-empty array of role names' });
        }

        // If roles are provided, ensure the request is authenticated and user has
        // permission to create roles. Accept either `req.user` (if auth middleware
        // ran) or a Bearer token in `Authorization` header.
        if (Array.isArray(roles) && roles.length > 0) {
            // If middleware didn't set req.user, attempt to decode a Bearer token
            if ((!req.user || !req.user.id) && req.headers && req.headers.authorization) {
                const parts = req.headers.authorization.split(' ');
                if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
                    try {
                        const decoded = jwt.verify(parts[1], process.env.JWT_SECRET);
                        // Normalize token payload into req.user expected shape
                        req.user = {
                            id: decoded.user_id || decoded.userId || decoded.id,
                            tenantId: decoded.tenantId || decoded.tenantId || decoded.tenantId,
                            role: decoded.role || decoded.user_role
                        };
                    } catch (e) {
                        return res.status(401).json({ success: false, error: 'Invalid auth token', code: 'INVALID_TOKEN' });
                    }
                }
            }

            // Check if user is authenticated now
            if (!req.user || !req.user.id) {
                return res.status(401).json({ success: false, error: 'Authentication required to assign roles to users', code: 'AUTH_REQUIRED' });
            }

            // Special restriction: Only Super Admin can assign "School Admin" role
            if (roles.includes('School Admin')) {
                const UserRole = require('../models/UserRole');
                const superAdminRole = await Role.findOne({ 
                    where: { name: 'Super Admin', isSystemRole: true } 
                });
                
                if (!superAdminRole) {
                    logger.error('Super Admin role not found in database');
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Server misconfiguration: Super Admin role not found',
                        code: 'ROLE_NOT_FOUND'
                    });
                }

                // Check if the requester has Super Admin role
                const userSuperAdminRole = await UserRole.findOne({
                    where: { 
                        userId: req.user.id || req.user.userId, 
                        tenantId: req.user.tenantId,
                        role: 'SUPER_ADMIN'
                    }
                });

                // Also check token role for backward compatibility
                const tokenRole = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : null;
                const isSuperAdminFromToken = tokenRole && (tokenRole === 'super admin' || tokenRole === 'superadmin');

                if (!userSuperAdminRole && !isSuperAdminFromToken) {
                    return res.status(403).json({ 
                        success: false, 
                        error: 'Only Super Admin can create users with School Admin role',
                        code: 'SCHOOL_ADMIN_CREATION_RESTRICTED'
                    });
                }
            }

            // Check if authenticated user has permission to create roles
            let userPermissionLevel = await checkPermission(req.user, 'user_management', 'create');

            // Backward-compatibility: some tokens/users carry a `role` string
            // (e.g. 'admin') that isn't represented in UserRole. Treat those
            // as having full create permission for onboarding flows.
            try {
                const tokenRole = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : null;
                if (tokenRole && (tokenRole === 'admin' || tokenRole === 'super admin' || tokenRole === 'superadmin')) {
                    userPermissionLevel = 'full';
                }
            } catch (e) {
                // ignore and proceed with computed permission
            }

            if (userPermissionLevel === 'none') {
                return res.status(403).json({ 
                    success: false, 
                    error: 'You do not have permission to assign roles to users',
                    code: 'PERMISSION_DENIED'
                });
            }

            // If the user doesn't have blanket/full permission, perform a
            // per-role subset check: ensure the user's allowedAccess covers all
            // permissions required by each requested role. If any role requires
            // permissions the user lacks, return a clear message listing them.
            if (userPermissionLevel !== 'full') {
                const allowedAccess = await getAllowedAccess(req.user.id, req.user.tenantId);
                const disallowedRoles = [];

                // Fetch role permission requirements for each requested role
                const rolePermissionChecks = (await Role.findAll({ where: { name: { [Op.in]: roles } } }))
                    .map(async (roleRec) => {
                        // Get permissions required by this role
                        const rp = await RolePermission.findAll({ where: { roleId: roleRec.id }, include: [{ model: Permission, as: 'permission' }] });
                        const required = {};
                        rp.forEach(r => {
                            const resName = r.permission.resource;
                            const action = r.permission.action;
                            if (!required[resName]) required[resName] = new Set();
                            required[resName].add(action);
                        });

                        // Check that allowedAccess covers required actions
                        let ok = true;
                        for (const [resName, actionsSet] of Object.entries(required)) {
                            const allowedActions = Array.isArray(allowedAccess[resName]) ? allowedAccess[resName] : [];
                            for (const act of actionsSet) {
                                if (!allowedActions.includes(act)) {
                                    ok = false;
                                    break;
                                }
                            }
                            if (!ok) break;
                        }

                        if (!ok) disallowedRoles.push(roleRec.name);
                    });

                await Promise.all(rolePermissionChecks);

                if (disallowedRoles.length > 0) {
                    return res.status(403).json({
                        success: false,
                        error: `You do not have permission to create user(s) with role(s): ${disallowedRoles.join(', ')}`,
                        code: 'PERMISSION_DENIED_FOR_ROLES',
                        details: disallowedRoles
                    });
                }
            }
            
            // Validate that all requested roles exist (regardless of permission level)
            const Op = require('sequelize').Op;
            const roleRecords = await Role.findAll({ 
                where: { 
                    name: { [Op.in]: roles },
                    [Op.or]: [
                        { tenantId: null, isSystemRole: true },
                        { tenantId: req.user.tenantId }
                    ]
                } 
            });
            
            const foundRoleNames = roleRecords.map(r => r.name);
            const notFound = roles.filter(r => !foundRoleNames.includes(r));
            if (notFound.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Role(s) not found: ${notFound.join(', ')}`,
                    code: 'ROLES_NOT_FOUND',
                    details: notFound
                });
            }
        }

        // Prevent duplicate email (user-friendly message)
        // Guard: ensure User model loaded correctly (avoid runtime TypeErrors)
        if (!User || typeof User.findOne !== 'function') {
            logger.error('User model not loaded correctly:', User);
            return res.status(500).json({ success: false, error: 'Server misconfiguration: User model not available' });
        }
        const existing = await User.findOne({ where: { email } });
        if (existing) {
            // Email already registered -> 409 Conflict with a machine-friendly code
            return res.status(409).json({ success: false, error: 'Email is already registered', code: 'EMAIL_TAKEN' });
        }

        // Create tenant (generate slug if not provided)
        const slugFromName = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const tenant = await Tenant.create({ name, slug: slugFromName });

        // Seed default roles and permissions for this tenant
        const { seedTenantRoles } = require('../services/rolePermissionService');
        try {
            await seedTenantRoles(tenant.id);
            logger.info(`✅ Seeded default roles for tenant: ${tenant.id}`);
        } catch (seedError) {
            logger.error('Failed to seed default roles for tenant:', seedError);
            // Continue with registration even if role seeding fails
        }

        // Hash password with increased rounds for better security
        const hashedPassword = await bcrypt.hash(password, 14);

        // Create admin user
        const user = await User.create({
            tenantId: tenant.id,
            email,
            passwordHash: hashedPassword,
            mustChangePassword: false,
            status: 'active'
        });

        // Ensure JWT secret is configured
        if (!process.env.JWT_SECRET) {
            logger.error('JWT_SECRET is not set in environment');
            return res.status(500).json({ success: false, error: 'Server misconfiguration: authentication secret is missing' });
        }

        // Assign default role if roles provided
        if (Array.isArray(roles) && roles.length > 0) {
            const UserRole = require('../models/UserRole');
            // Map role names to ENUM values
            const roleEnumMap = {
                'Super Admin': 'SUPER_ADMIN',
                'School Admin': 'SCHOOL_ADMIN',
                'Teacher': 'TEACHER',
                'Staff': 'STAFF',
                'Student': 'STUDENT',
                'Parent': 'PARENT',
                'Accountant': 'ACCOUNTANT',
                'Librarian': 'LIBRARIAN',
                'Admin': 'ADMIN'
            };
            
            for (const roleName of roles) {
                const roleEnum = roleEnumMap[roleName] || roleName.toUpperCase().replace(/\s+/g, '_');
                await UserRole.create({
                    userId: user.id,
                    tenantId: tenant.id,
                    role: roleEnum
                });
            }
        }
        
        // Get user's roles
        const UserRole = require('../models/UserRole');
        const userRoles = await UserRole.findAll({
            where: { userId: user.id, tenantId: tenant.id }
        });
        const rolesArray = userRoles.map(ur => ur.role);
        
        // Generate access token (short-lived)
        const accessToken = jwt.sign({
            userId: user.id,
            tenantId: tenant.id,
            roles: rolesArray,
            type: 'access'
        }, process.env.JWT_SECRET, { expiresIn: '15m' });
        
        // Generate refresh token (long-lived)
        const refreshToken = jwt.sign({
            userId: user.id,
            tenantId: tenant.id,
            type: 'refresh'
        }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        // Set secure cookies
        setAccessTokenCookie(res, accessToken);
        setRefreshTokenCookie(res, refreshToken);

        // assignedRoles already set above
        let assignedRoles = [];
        if (Array.isArray(roles) && roles.length > 0) {
            assignedRoles = roles.map(roleName => ({ name: roleName }));
        }

        // Compute primary role and allowed access for the new user so UI can initialize properly
        const primaryRole = await getUserPrimaryRole(user.id, tenant.id);
        const allowedAccess = await getAllowedAccess(user.id, tenant.id);

        // Return response without tokens in body (tokens are in cookies)
        // Still include token in response for backward compatibility with clients that don't use cookies
        res.status(201).json({
            success: true,
            token: accessToken, // Backward compatibility - prefer using cookie
            tenant: { id: tenant.id, name: tenant.name },
            tenantId: tenant.id,
            user: {
                id: user.id,
                email: user.email,
                tenantId: tenant.id,
                roles: rolesArray,
                role: rolesArray.length > 0 ? rolesArray[0] : (primaryRole ? primaryRole.name : null),
                allowedAccess
            },
            roles: assignedRoles
        });
    } catch (err) {
        // Handle common Sequelize errors to return useful messages for UI
        if (err && err.name === 'SequelizeUniqueConstraintError') {
            // Map DB unique constraint to a 409 conflict for the client
            const field = err.errors && err.errors[0] && (err.errors[0].path || err.errors[0].field);
            const message = field ? `${field} already exists` : 'Duplicate value';
            const code = (field && field.toLowerCase().includes('email')) ? 'EMAIL_TAKEN' : 'DUPLICATE_VALUE';
            return res.status(409).json({ success: false, error: message, code });
        }
        if (err && err.name === 'SequelizeValidationError') {
            const messages = err.errors ? err.errors.map(e => e.message) : [err.message];
            return res.status(400).json({ success: false, error: 'Validation error', code: 'VALIDATION_ERROR', details: messages });
        }

        // Delegate error mapping & response to centralized helper
        return sendError(res, err, 'Registration failed. Please try again later.');
    }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login user
 *     description: Authenticates user and sets secure HTTP-only cookies (accessToken and refreshToken). Also returns token in response body for backward compatibility.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@school.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Login successful. Cookies are set automatically. If mustChangePassword is true, returns requiresPasswordReset flag with tempToken.
 *         headers:
 *           Set-Cookie:
 *             description: HTTP-only cookies containing access and refresh tokens
 *             schema:
 *               type: string
 *               example: accessToken=...; HttpOnly; Secure; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Normal login response
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     token:
 *                       type: string
 *                       description: Access token (also in cookie). Prefer using cookie.
 *                     tenantId:
 *                       type: string
 *                       format: uuid
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                           format: email
 *                         tenantId:
 *                           type: string
 *                           format: uuid
 *                         roles:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Array of user roles (ENUM values)
 *                         role:
 *                           type: string
 *                           description: Primary role (first in roles array)
 *                         allowedAccess:
 *                           type: object
 *                 - type: object
 *                   description: Password reset required response
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     requiresPasswordReset:
 *                       type: boolean
 *                       example: true
 *                     tempToken:
 *                       type: string
 *                       description: Temporary token for password reset (valid 15 minutes)
 *                     message:
 *                       type: string
 *                       example: Password change required on first login
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account inactive or suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', require('../middleware/validation'), async (req, res) => {
    const logger = require('../config/logger');
    try {
        const { email, password, tenantId } = req.body;
        if (!User || typeof User.findOne !== 'function') {
            logger.error('User model not loaded correctly for login:', User);
            return res.status(500).json({ success: false, error: 'Server misconfiguration: User model not available' });
        }
        
        // Find user by tenantId and email (tenant-scoped)
        const whereClause = tenantId 
            ? { email, tenantId }
            : { email };
        const user = await User.findOne({ where: whereClause });
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        // Check user status
        if (user.status !== 'active') {
            return res.status(403).json({ 
                success: false, 
                error: `Account is ${user.status}`,
                code: 'ACCOUNT_INACTIVE'
            });
        }
        
        // Verify password
        if (!await bcrypt.compare(password, user.passwordHash)) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        // Check if password must be changed
        if (user.mustChangePassword) {
            // Generate temporary token for password reset (valid for 15 minutes)
            const tempToken = jwt.sign({
                userId: user.id,
                tenantId: user.tenantId,
                type: 'password_reset',
                mustChange: true
            }, process.env.JWT_SECRET, { expiresIn: '15m' });
            
            return res.json({
                success: true,
                requiresPasswordReset: true,
                tempToken,
                message: 'Password change required on first login'
            });
        }
        
        // Get user's roles from UserRole table
        const UserRole = require('../models/UserRole');
        const userRoles = await UserRole.findAll({
            where: { userId: user.id, tenantId: user.tenantId }
        });
        const roles = userRoles.map(ur => ur.role);
        
        // Get user's primary role and allowed access (for backward compatibility with RBAC)
        const primaryRole = await getUserPrimaryRole(user.id, user.tenantId);
        const allowedAccess = await getAllowedAccess(user.id, user.tenantId);
        
        // Generate access token (short-lived) with roles array
        const accessToken = jwt.sign({
            userId: user.id,
            tenantId: user.tenantId,
            roles: roles,
            type: 'access'
        }, process.env.JWT_SECRET, { expiresIn: '15m' });
        
        // Generate refresh token (long-lived)
        const refreshToken = jwt.sign({
            userId: user.id,
            tenantId: user.tenantId,
            type: 'refresh'
        }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        // Set secure cookies
        setAccessTokenCookie(res, accessToken);
        setRefreshTokenCookie(res, refreshToken);
        
        // Return response without tokens in body (tokens are in cookies)
        // Still include token in response for backward compatibility
        res.json({ 
            success: true, 
            token: accessToken, // Backward compatibility - prefer using cookie
            tenantId: user.tenantId,
            user: {
                id: user.id,
                email: user.email,
                tenantId: user.tenantId,
                roles: roles,
                role: roles.length > 0 ? roles[0] : (primaryRole ? primaryRole.name : null),
                allowedAccess
            }
        });
    } catch (err) {
        return sendError(res, err, 'Login failed. Please try again later.');
    }
});

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reset password (forced or forgot password)
 *     description: Allows users to set a new password. Used for forced password reset on first login or forgot password flow.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tempToken
 *               - newPassword
 *             properties:
 *               tempToken:
 *                 type: string
 *                 description: Temporary token from login (if mustChangePassword) or forgot password email
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful. Returns JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid or expired token
 */
router.post('/reset-password', require('../middleware/validation'), async (req, res) => {
    const logger = require('../config/logger');
    try {
        const { tempToken, newPassword } = req.body;
        
        if (!tempToken || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'tempToken and newPassword are required' 
            });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ 
                success: false, 
                error: 'Password must be at least 8 characters' 
            });
        }
        
        // Verify tempToken
        let decoded;
        try {
            decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
            
            if (decoded.type !== 'password_reset') {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid token type',
                    code: 'INVALID_TOKEN_TYPE'
                });
            }
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Token expired. Please request a new password reset.',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }
        
        // Get user
        const user = await User.findByPk(decoded.userId);
        if (!user || user.tenantId !== decoded.tenantId) {
            return res.status(401).json({ 
                success: false, 
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Check user status
        if (user.status !== 'active') {
            return res.status(403).json({ 
                success: false, 
                error: `Account is ${user.status}`,
                code: 'ACCOUNT_INACTIVE'
            });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 14);
        
        // Update user
        await user.update({
            passwordHash: hashedPassword,
            mustChangePassword: false,
            lastPasswordChangedAt: new Date()
        });
        
        // Get user's roles
        const UserRole = require('../models/UserRole');
        const userRoles = await UserRole.findAll({
            where: { userId: user.id, tenantId: user.tenantId }
        });
        const roles = userRoles.map(ur => ur.role);
        
        // Get allowed access
        const allowedAccess = await getAllowedAccess(user.id, user.tenantId);
        
        // Generate permanent JWT
        const accessToken = jwt.sign({
            userId: user.id,
            tenantId: user.tenantId,
            roles: roles,
            type: 'access'
        }, process.env.JWT_SECRET, { expiresIn: '15m' });
        
        const refreshToken = jwt.sign({
            userId: user.id,
            tenantId: user.tenantId,
            type: 'refresh'
        }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        // Set secure cookies
        setAccessTokenCookie(res, accessToken);
        setRefreshTokenCookie(res, refreshToken);
        
        res.json({
            success: true,
            token: accessToken,
            user: {
                id: user.id,
                email: user.email,
                tenantId: user.tenantId,
                roles: roles,
                role: roles.length > 0 ? roles[0] : null,
                allowedAccess
            }
        });
    } catch (err) {
        return sendError(res, err, 'Password reset failed. Please try again later.');
    }
});

// GET /api/profile
/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile with roles and allowed access permissions
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                       format: email
 *                     tenantId:
 *                       type: string
 *                       format: uuid
 *                     role:
 *                       type: string
 *                     allowedAccess:
 *                       type: object
 *                       description: RBAC permissions map
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/profile', authenticateToken, userController.getProfile);


// GET /api/auth/available-roles
/**
 * @openapi
 * /api/auth/available-roles:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get roles the authenticated user can create/manage
 *     description: Returns role templates the current user may assign when creating users for a tenant. Uses RBAC permissions to determine capability.
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Optional tenant ID to consider (defaults to user's tenant)
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/available-roles', authenticateToken, async (req, res) => {
    try {
        const userId = req.user && (req.user.user_id || req.user.id);
        const userTenant = req.user && (req.user.tenantId || req.user.tenantId || req.user.tenant);
        const queryTenant = req.query && req.query.tenantId ? req.query.tenantId : null;

        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

        // Determine user's primary role and whether they are a system-level role
        const primaryRole = await getUserPrimaryRole(userId, userTenant);
        const isSystemUser = primaryRole && primaryRole.isSystemRole;

        // If a tenant is specified and the requester is not system-level and the tenant doesn't match their tenant, forbid
        if (queryTenant && !isSystemUser && queryTenant !== userTenant) {
            return res.status(403).json({ success: false, error: 'Forbidden: cannot query roles for other tenant' });
        }

        // Check RBAC permission for creating users in the relevant tenant context
        const checkUser = { id: userId, tenantId: userTenant };
        const createLevel = await checkPermission(checkUser, 'user_management', 'create');

        // Fetch candidate roles: system roles + roles for the tenant in question (if provided) or user's tenant
        const tenantToCheck = queryTenant || userTenant;
        const allRoles = await Role.findAll();

        // Build allowed list based on dynamic RBAC checks and stricter subset rule
        // Creator's allowed actions per resource
        const creatorAllowed = await getAllowedAccess(userId, userTenant);

        if (createLevel === 'none') {
            return res.json({ success: true, data: [] });
        }

        // For performance, fetch RolePermissions for all candidate roles in parallel
        const candidateRoles = allRoles.filter(r => {
            // System roles handled specially
            if (r.isSystemRole) return true;

            // Tenant-scoped: require a tenant context
            if (!tenantToCheck) return false;
            if (r.tenantId && r.tenantId !== tenantToCheck) return false;
            return true;
        });

        const rolePermPromises = candidateRoles.map(r =>
            RolePermission.findAll({ where: { roleId: r.id }, include: [{ model: Permission, as: 'permission' }] })
                .then(perms => ({ role: r, perms }))
        );

        const rolePermResults = await Promise.all(rolePermPromises);

        const allowed = [];
        for (const { role: r, perms } of rolePermResults) {
            // System roles: require system-level creator
            if (r.isSystemRole && !isSystemUser) continue;

            // Build target permission map: resource -> Set(actions)
            const targetMap = {};
            perms.forEach(rp => {
                const p = rp.permission;
                if (!p) return;
                if (!targetMap[p.resource]) targetMap[p.resource] = new Set();
                targetMap[p.resource].add(p.action);
            });

            // If role has no explicit permissions mapped, skip (conservative)
            if (Object.keys(targetMap).length === 0) continue;

            // Check subset: every action in targetMap must be present in creatorAllowed
            let isSubset = true;
            for (const [resource, actionsSet] of Object.entries(targetMap)) {
                const creatorActions = creatorAllowed[resource] || [];
                for (const action of actionsSet) {
                    if (!creatorActions.includes(action)) {
                        isSubset = false;
                        break;
                    }
                }
                if (!isSubset) break;
            }

            if (isSubset) {
                allowed.push(r);
            }
        }

        const available = allowed.map(r => ({ id: r.id, name: r.name, description: r.description, isSystemRole: r.isSystemRole }));
        res.json({ success: true, data: available });
    } catch (err) {
        return sendError(res, err, 'Failed to get available roles');
    }
});

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Refresh access token
 *     description: Uses refresh token from HTTP-only cookie to generate a new access token. Optionally rotates refresh token for enhanced security.
 *     security: []
 *     responses:
 *       200:
 *         description: New access token generated and set in cookie
 *         headers:
 *           Set-Cookie:
 *             description: New access token cookie (and optionally new refresh token)
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: New access token (also in cookie)
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     tenantId:
 *                       type: string
 *                       format: uuid
 *                     role:
 *                       type: string
 *                     allowedAccess:
 *                       type: object
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *               example:
 *                 success: false
 *                 error: 'Refresh token expired. Please login again.'
 *                 code: 'REFRESH_TOKEN_EXPIRED'
 */
router.post('/refresh', async (req, res) => {
    const logger = require('../config/logger');
    try {
        const refreshToken = getRefreshTokenFromRequest(req);
        
        if (!refreshToken) {
            return res.status(401).json({ 
                success: false, 
                error: 'Refresh token required', 
                code: 'REFRESH_TOKEN_REQUIRED' 
            });
        }
        
        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
            
            // Ensure it's a refresh token
            if (decoded.type !== 'refresh') {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid token type', 
                    code: 'INVALID_TOKEN_TYPE' 
                });
            }
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                // Clear expired refresh token cookie
                clearAuthCookies(res);
                return res.status(401).json({ 
                    success: false, 
                    error: 'Refresh token expired. Please login again.', 
                    code: 'REFRESH_TOKEN_EXPIRED' 
                });
            }
            throw err;
        }
        
        // Get user to ensure they still exist and are active
        const user = await User.findByPk(decoded.userId || decoded.id);
        if (!user) {
            clearAuthCookies(res);
            return res.status(401).json({ 
                success: false, 
                error: 'User not found', 
                code: 'USER_NOT_FOUND' 
            });
        }
        
        // Get user's roles
        const UserRole = require('../models/UserRole');
        const userRoles = await UserRole.findAll({
            where: { userId: user.id, tenantId: user.tenantId }
        });
        const roles = userRoles.map(ur => ur.role);
        
        // Get user's primary role and allowed access
        const primaryRole = await getUserPrimaryRole(user.id, user.tenantId);
        const allowedAccess = await getAllowedAccess(user.id, user.tenantId);
        
        // Generate new access token
        const newAccessToken = jwt.sign({
            userId: user.id,
            tenantId: user.tenantId,
            roles: roles,
            type: 'access'
        }, process.env.JWT_SECRET, { expiresIn: '15m' });
        
        // Optionally rotate refresh token (security best practice)
        const rotateRefreshToken = process.env.ROTATE_REFRESH_TOKEN !== 'false';
        let newRefreshToken = refreshToken;
        
        if (rotateRefreshToken) {
            // Generate new refresh token
            newRefreshToken = jwt.sign({
                userId: user.id,
                tenantId: user.tenantId,
                type: 'refresh'
            }, process.env.JWT_SECRET, { expiresIn: '7d' });
            setRefreshTokenCookie(res, newRefreshToken);
        }
        
        // Set new access token cookie
        setAccessTokenCookie(res, newAccessToken);
        
        res.json({
            success: true,
            token: newAccessToken, // Backward compatibility
            user: {
                id: user.id,
                email: user.email,
                tenantId: user.tenantId,
                roles: roles,
                role: roles.length > 0 ? roles[0] : (primaryRole ? primaryRole.name : null),
                allowedAccess
            }
        });
    } catch (err) {
        logger.error('Token refresh error:', err);
        clearAuthCookies(res);
        return sendError(res, err, 'Token refresh failed');
    }
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Logout user
 *     description: Clears authentication cookies (accessToken and refreshToken) and invalidates session. Works with both cookie and bearer token authentication.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out. Cookies are cleared.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Successfully logged out'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // Clear authentication cookies
        clearAuthCookies(res);
        
        // TODO: In a production system, you might want to:
        // 1. Add refresh token to a blacklist (Redis/database)
        // 2. Log the logout event
        // 3. Invalidate all user sessions if needed
        
        res.json({ 
            success: true, 
            message: 'Successfully logged out' 
        });
    } catch (err) {
        // Even if there's an error, clear cookies
        clearAuthCookies(res);
        return sendError(res, err, 'Logout failed');
    }
});

module.exports = router;

