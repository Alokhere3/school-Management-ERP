# 🚀 Quick Setup Reference

## One-Command Database Setup

```bash
npm run seed
```

That's it! This creates:
- ✅ 100 permissions (20 modules × 5 actions)
- ✅ Super Admin system role (full access to everything)
- ✅ 10 tenant-level roles (School Admin, Teacher, etc.)
- ✅ System tenant (admin portal)
- ✅ Super Admin user

---

## 🔐 Login Credentials (Default)

```
Email:    admin@schoolerp.com
Password: SuperAdmin@123
```

**⚠️ Change these on first login!**

---

## 🔑 Customize Credentials

```bash
# Via environment variables
SUPER_ADMIN_EMAIL=admin@myschool.com \
SUPER_ADMIN_PASSWORD=MySecure@Pass123 \
npm run seed
```

Or create `.env`:
```env
SUPER_ADMIN_EMAIL=admin@myschool.com
SUPER_ADMIN_PASSWORD=MySecure@Pass123
```

---

## 📋 What Gets Created

### Permissions (100 total)
```
20 Modules:
  • tenant_management      • students          • exams
  • school_config         • admissions        • communication
  • user_management       • fees              • transport
  • attendance_students   • timetable         • library
  • attendance_staff      • (& 7 more)

5 Actions (per module):
  • create  • read  • update  • delete  • export
```

### System Roles
- **Super Admin**: Full access to all 100 permissions

### Tenant-Level Roles (10)
1. School Admin (full)
2. Principal (read + full on students/exams)
3. Teacher (limited access)
4. Accountant (fees, payroll, analytics)
5. HR Manager (staff, payroll)
6. Librarian (library, inventory)
7. Transport Manager (transport)
8. Hostel Warden (hostel)
9. Parent (limited student data)
10. Student (own data, LMS)

### Users
- **Super Admin User**: admin@schoolerp.com

---

## ✅ Verify Setup

```bash
# Login as super admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@schoolerp.com","password":"SuperAdmin@123"}'

# Check database
psql -c "SELECT COUNT(*) FROM permissions;"        # 100
psql -c "SELECT COUNT(*) FROM roles;"              # 11 (1 system + 10 tenant)
psql -c "SELECT * FROM users WHERE email='admin@schoolerp.com';"
```

---

## 🛠️ File Details

| File | Purpose |
|------|---------|
| `scripts/seedDatabase.js` | Main seed script - creates all RBAC |
| `package.json` | npm run seed & seed:prod scripts |
| `models/Role.js` | Role model with validation hook |
| `routes/auth.js` | Registration with improved role validation |
| `docs/SEEDING_GUIDE.md` | Detailed setup guide |

---

## ⚡ Troubleshooting

### "Database connection failed"
```bash
# Check database is running
psql -U postgres -l  # List databases
```

### "Role not found during registration"
Fixed! The new code validates tenant roles against a known list before seeding.

### "Super admin already exists"
Safe to re-run seed - password will be reset to default.

### "Permission denied"
Ensure NODE_ENV and DATABASE_URL are correct

---

## 🔄 Workflow

1. **Setup DB**
   ```bash
   npm run seed
   ```

2. **Start Server**
   ```bash
   npm run dev
   ```

3. **Login as Super Admin**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -d '{"email":"admin@schoolerp.com","password":"SuperAdmin@123"}'
   ```

4. **Register First School**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -d '{
       "name": "My School",
       "email": "admin@myschool.com",
       "password": "Pass@123",
       "roles": ["School Admin"]
     }'
   ```

---

## 📖 Full Documentation

See [SEEDING_GUIDE.md](SEEDING_GUIDE.md) for complete details.
