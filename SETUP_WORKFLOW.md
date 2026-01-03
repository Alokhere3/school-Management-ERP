# Complete Database Setup Workflow

## 📋 Table of Contents
1. [Fresh Database Setup](#fresh-database-setup)
2. [First User Registration](#first-user-registration)
3. [Verification Steps](#verification-steps)
4. [Production Deployment](#production-deployment)
5. [Troubleshooting](#troubleshooting)

---

## Fresh Database Setup

### Step 1: Create Database
```bash
# Using psql
createdb school_erp

# Or using your database tool
# Ensure encoding is UTF-8
CREATE DATABASE school_erp ENCODING 'UTF8';
```

### Step 2: Configure Connection
Create `.env` file:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/school_erp
NODE_ENV=development
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Run Seed Script
```bash
npm run seed
```

Expected output:
```
════════════════════════════════════════════════════════════════════════════════
🌱 Database Seed Script - Initializing RBAC and Super Admin
════════════════════════════════════════════════════════════════════════════════
1️⃣  Connecting to database...
✅ Database connection successful
...
✅ DATABASE SEEDING COMPLETED SUCCESSFULLY
════════════════════════════════════════════════════════════════════════════════
```

---

## First User Registration

### Step 1: Start Server
```bash
npm run dev
```

Expected output:
```
Server running on http://localhost:3000
```

### Step 2: Login as Super Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@schoolerp.com",
    "password": "SuperAdmin@123"
  }'
```

Response:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "admin@schoolerp.com",
    "role": "SUPER_ADMIN",
    "tenantId": "uuid-here"
  }
}
```

### Step 3: Register First School
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Central High School",
    "email": "admin@centralhigh.com",
    "password": "AdminPass@123",
    "roles": ["School Admin"]
  }'
```

Response:
```json
{
  "success": true,
  "message": "Tenant and admin user created successfully",
  "tenant": {
    "id": "tenant-uuid",
    "name": "Central High School",
    "slug": "central-high-school"
  },
  "user": {
    "id": "user-uuid",
    "email": "admin@centralhigh.com",
    "status": "active"
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

---

## Verification Steps

### 1. Verify Database Connection
```bash
# Test PostgreSQL connection
psql -U username -d school_erp -c "SELECT 1;"
# Result: 1
```

### 2. Verify Permissions Created
```sql
-- Count total permissions
SELECT COUNT(*) as total, 
       COUNT(DISTINCT resource) as modules,
       COUNT(DISTINCT action) as actions
FROM permissions;

-- Expected: total=100, modules=20, actions=5
```

### 3. Verify System Role
```sql
-- Check super admin role
SELECT id, name, is_system_role, tenant_id 
FROM roles 
WHERE name = 'Super Admin';

-- Expected: 1 record with is_system_role=true, tenant_id=NULL
```

### 4. Verify Tenant Roles
```sql
-- Check tenant-level roles
SELECT name, COUNT(*) as count
FROM roles 
WHERE is_system_role = false
GROUP BY name
ORDER BY name;

-- Expected: 10 roles (School Admin, Principal, Teacher, etc.)
```

### 5. Verify Super Admin User
```sql
-- Check super admin user exists
SELECT u.id, u.email, u.status, ur.role
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@schoolerp.com';

-- Expected: 1 record with role=SUPER_ADMIN
```

### 6. Verify System Tenant
```sql
-- Check system tenant
SELECT id, name, slug FROM tenants WHERE slug = 'system';

-- Expected: 1 record with name='System Tenant (Admin Portal)'
```

### 7. Verify Role Permissions
```sql
-- Check that Super Admin has all permissions
SELECT COUNT(*) as permission_count
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
WHERE r.name = 'Super Admin';

-- Expected: 100 (all permissions)
```

---

## Production Deployment

### Pre-Deployment Checklist

```bash
# 1. Backup production database (CRITICAL!)
pg_dump production_database > backup.sql

# 2. Test in staging environment
SUPER_ADMIN_EMAIL=admin@staging.com \
SUPER_ADMIN_PASSWORD=$(openssl rand -base64 32) \
npm run seed:prod

# 3. Verify staging environment
curl -X POST https://staging.example.com/api/auth/login \
  -d '{"email":"admin@staging.com","password":"..."}'

# 4. Document credentials in secure location
# (e.g., password manager, CI/CD secrets)
```

### Deployment Steps

```bash
# 1. Set environment variables
export DATABASE_URL="postgresql://prod_user:prod_pass@prod_host:5432/school_erp"
export SUPER_ADMIN_EMAIL="ops@company.com"
export SUPER_ADMIN_PASSWORD=$(echo $PROD_ADMIN_PASSWORD)  # From secrets

# 2. Run migrations (if any)
npm run migrate

# 3. Seed database
npm run seed:prod

# 4. Start application
npm start

# 5. Verify production deployment
curl -X POST https://api.example.com/api/auth/login \
  -d '{"email":"ops@company.com","password":"..."}'
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY . .

# Run seed on container start
CMD npm run seed:prod && npm start
```

Deploy:
```bash
docker build -t school-erp:latest .
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e SUPER_ADMIN_EMAIL="ops@company.com" \
  -e SUPER_ADMIN_PASSWORD="secure-password" \
  school-erp:latest
```

### Kubernetes Deployment

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-seed
spec:
  template:
    spec:
      containers:
      - name: seed
        image: school-erp:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: SUPER_ADMIN_EMAIL
          valueFrom:
            secretKeyRef:
              name: admin-credentials
              key: email
        - name: SUPER_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: admin-credentials
              key: password
        command: ["npm", "run", "seed:prod"]
      restartPolicy: Never
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: school-erp-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: school-erp:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /api/auth/login
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

---

## Troubleshooting

### Issue: "Connection refused" when seeding

**Cause**: Database not running or wrong host

**Solution**:
```bash
# Check PostgreSQL status
systemctl status postgresql  # Linux
brew services list | grep postgres  # Mac
Get-Service postgresql  # Windows

# Verify connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Issue: "Role already exists" error

**Cause**: Seed run twice without idempotency

**Solution**:
```bash
# This shouldn't happen with findOrCreate, but if it does:
# Check existing roles
psql -d school_erp -c "SELECT * FROM roles WHERE name='Super Admin';"

# Script handles this automatically - safe to re-run
npm run seed
```

### Issue: "Super Admin user not found" when logging in

**Cause**: User wasn't created or wrong email

**Solution**:
```bash
# Check user exists
psql -d school_erp -c "SELECT * FROM users WHERE email='admin@schoolerp.com';"

# If not found, re-run seed
npm run seed

# If found but password wrong:
SUPER_ADMIN_PASSWORD="NewPassword@123" npm run seed
```

### Issue: Permissions not assigned to role

**Cause**: Role permissions mapping failed

**Solution**:
```bash
# Check role permissions
psql -d school_erp -c "
  SELECT COUNT(*) FROM role_permissions 
  WHERE role_id = (SELECT id FROM roles WHERE name='Super Admin');
"

# Should return 100

# If not, check for errors in seed output
npm run seed 2>&1 | grep -i error
```

### Issue: Seed script timeout

**Cause**: Slow database connection or large dataset

**Solution**:
```bash
# Increase Node.js memory
node --max-old-space-size=4096 scripts/seedDatabase.js

# Increase timeout
timeout 120s npm run seed

# Check database logs
tail -f /var/log/postgresql/postgresql.log
```

### Issue: "Cannot find module" errors

**Cause**: Dependencies not installed

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Verify specific packages
npm list bcryptjs sequelize dotenv

# Run seed again
npm run seed
```

---

## Quick Commands Reference

```bash
# Setup & Initialization
npm install                    # Install dependencies
npm run seed                   # Seed development database
npm run seed:prod              # Seed production database
npm run dev                    # Start development server
npm start                      # Start production server

# Database Operations
psql -d school_erp -c "SELECT COUNT(*) FROM permissions;"
psql -d school_erp -c "SELECT * FROM users WHERE email='admin@schoolerp.com';"
pg_dump school_erp > backup.sql
psql -d school_erp < backup.sql

# API Testing
curl -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"admin@schoolerp.com","password":"SuperAdmin@123"}'

curl -X POST http://localhost:3000/api/auth/register \
  -d '{"name":"School","email":"admin@school.com","password":"Pass@123","roles":["School Admin"]}'

# Monitoring
npm run dev -- --inspect=0.0.0.0:9229  # Enable Node.js debugger
node --max-old-space-size=4096 server.js  # Increase memory
```

---

## Files Created/Modified

| File | Type | Purpose |
|------|------|---------|
| scripts/seedDatabase.js | NEW | Complete seed script |
| package.json | MODIFIED | Added seed scripts |
| QUICK_SETUP.md | NEW | Quick reference |
| SEEDING_GUIDE.md | NEW | Complete guide |
| SEED_SCRIPT_README.md | NEW | Script documentation |
| SEEDING_REFACTORING_SUMMARY.md | NEW | Summary of changes |

---

## Success Criteria

After following this workflow, verify:

✅ Database created and accessible  
✅ All 100 permissions exist  
✅ Super Admin system role created  
✅ 10 tenant-level roles created  
✅ System tenant exists  
✅ Super Admin user created and can login  
✅ First school (tenant) can be registered  
✅ School Admin role assigned to new school admin user  

---

**Documentation Version**: 1.0.0  
**Last Updated**: January 3, 2026  
**Status**: ✅ Ready for Production
