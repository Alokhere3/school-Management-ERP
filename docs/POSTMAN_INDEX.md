# Postman Documentation Index

## 📚 Complete Documentation

This folder contains comprehensive Postman configuration and documentation for the School ERP API.

### Files Overview

#### 1. **Collection & Environment** (Postman Files)
- `postman_collection.json` - API requests collection (enhanced with token scripts)
- `postman_environment.json` - Environment variables (with token variables)

#### 2. **Documentation Guides** (Read These!)

##### Quick Start (5 minutes) ⚡
📄 **[POSTMAN_QUICK_REFERENCE.md](POSTMAN_QUICK_REFERENCE.md)**
- Import instructions
- 3-step quick start
- Common workflows
- Debugging checklist
- Token variables reference
- **Best for:** First-time users

##### Complete Setup Guide (15 minutes) 📖
📄 **[POSTMAN_SETUP_GUIDE.md](POSTMAN_SETUP_GUIDE.md)**
- Detailed import instructions
- Token extraction explained
- Pre-request/test scripts explained
- API endpoint reference
- Troubleshooting section
- Advanced customization
- **Best for:** Deep understanding

##### Visual Flow Diagrams (10 minutes) 📊
📄 **[TOKEN_COOKIE_FLOW.md](TOKEN_COOKIE_FLOW.md)**
- Login flow diagram
- Authenticated request flow
- Token sources (priority order)
- Multi-user management diagram
- Cookie persistence explained
- Error handling flow
- **Best for:** Visual learners

##### Summary & Features (3 minutes) 📋
📄 **[POSTMAN_CONFIG_SUMMARY.md](POSTMAN_CONFIG_SUMMARY.md)**
- What was updated
- How token management works
- Usage examples
- Getting started
- Feature highlights
- **Best for:** Understanding what changed

#### 3. **API Documentation** (Related)
- `API.md` - Complete API endpoint documentation
- `POSTMAN.md` - Original minimal Postman guide

---

## 🚀 Quick Navigation

### "I want to..."

#### ▶️ Get Started Immediately
1. Read: [POSTMAN_QUICK_REFERENCE.md](POSTMAN_QUICK_REFERENCE.md) (5 min)
2. Import both JSON files into Postman
3. Run: Auth → 🔐 Login (Super Admin)
4. Make requests! ✅

#### ▶️ Understand Token Management
1. Read: [TOKEN_COOKIE_FLOW.md](TOKEN_COOKIE_FLOW.md) (visual diagrams)
2. Read: [POSTMAN_SETUP_GUIDE.md](POSTMAN_SETUP_GUIDE.md) → "Token Extraction Scripts" section

#### ▶️ Set Up Multi-User Testing
1. Read: [POSTMAN_QUICK_REFERENCE.md](POSTMAN_QUICK_REFERENCE.md) → "Workflow 2: School Admin Testing"
2. Read: [TOKEN_COOKIE_FLOW.md](TOKEN_COOKIE_FLOW.md) → "MULTI-USER TOKEN MANAGEMENT"
3. Follow the examples

#### ▶️ Debug a Problem
1. Check: [POSTMAN_QUICK_REFERENCE.md](POSTMAN_QUICK_REFERENCE.md) → "Debugging" section
2. If still stuck: [POSTMAN_SETUP_GUIDE.md](POSTMAN_SETUP_GUIDE.md) → "Troubleshooting"

#### ▶️ Customize for My Needs
1. Read: [POSTMAN_SETUP_GUIDE.md](POSTMAN_SETUP_GUIDE.md) → "Advanced: Custom Pre-Request Script"
2. Edit collection/environment directly in Postman

---

## 📖 Reading Order (Recommended)

### For New Users (Total: 20 minutes)
1. **[POSTMAN_QUICK_REFERENCE.md](POSTMAN_QUICK_REFERENCE.md)** (5 min)
   - Understand basics
   - Import files
   - First login

2. **[TOKEN_COOKIE_FLOW.md](TOKEN_COOKIE_FLOW.md)** (10 min)
   - See visual flows
   - Understand token sources
   - Learn cookie handling

3. **Start using!**
   - Import files
   - Login
   - Make requests

### For Complete Understanding (Total: 30 minutes)
1. **[POSTMAN_CONFIG_SUMMARY.md](POSTMAN_CONFIG_SUMMARY.md)** (3 min)
   - Understand changes

2. **[POSTMAN_QUICK_REFERENCE.md](POSTMAN_QUICK_REFERENCE.md)** (5 min)
   - Quick overview

3. **[POSTMAN_SETUP_GUIDE.md](POSTMAN_SETUP_GUIDE.md)** (15 min)
   - Complete details
   - All features
   - Troubleshooting

4. **[TOKEN_COOKIE_FLOW.md](TOKEN_COOKIE_FLOW.md)** (7 min)
   - Visual reinforcement
   - Complex flows

---

## 🎯 Key Features Explained

### Automatic Token Management
- ✅ Login response → token extracted → saved to environment
- ✅ Pre-request → token injected → sent to API
- ✅ Works with cookies and response body tokens

### Multi-User Support
- ✅ Separate tokens for Super Admin, School Admin, Teacher
- ✅ Switch users by updating `{{token}}` variable
- ✅ Each role's token stored independently

### Cookie Support
- ✅ API sets cookies? Automatically extracted
- ✅ Postman restart? Cookies persist (like browser)
- ✅ Pre-request script reads cookies if needed

### Complete Documentation
- ✅ Quick reference for common tasks
- ✅ Complete setup guide for details
- ✅ Visual diagrams for understanding flows
- ✅ Troubleshooting section for problems

---

## 🔧 Environment Variables

### Auto-Set by Login ✅
```
{{token}}           - Current active token
{{superAdminToken}} - Super Admin's JWT
{{adminToken}}      - School Admin's JWT
{{tenantId}}        - Current tenant ID
{{userId}}          - Current user ID
```

### Manual Setup ⚙️
```
{{baseUrl}}           - http://localhost:3000
{{superAdminEmail}}   - alokhere3@gmail.com
{{superAdminPassword}} - Alok@1234
{{adminEmail}}        - your email
{{adminPassword}}     - your password
```

---

## 🔐 Security Highlights

- JWT tokens stored in environment (not exposed)
- Tokens injected in Authorization header
- Automatic cookie extraction (safe)
- No manual token copying needed
- Tokens cleared when needed

---

## 📞 Quick Help

### Problem: "Unauthorized 401"
**Solution:** 
1. Re-run login request: Auth → 🔐 Login (Super Admin)
2. Check Environment for {{token}} value

### Problem: "Forbidden 403"
**Solution:**
1. Using wrong role
2. Use Super Admin for admin operations
3. Use School Admin for school operations

### Problem: "Token not extracting"
**Solution:**
1. Check Postman Console (View → Show Postman Console)
2. Look for error messages
3. Verify response contains token

### Problem: "Don't know where to start"
**Solution:**
1. Read: [POSTMAN_QUICK_REFERENCE.md](POSTMAN_QUICK_REFERENCE.md)
2. 5 minutes to understand basics
3. 5 more minutes to setup

---

## 📚 Related Documentation

See also:
- [../SETUP_INSTRUCTIONS.md](../SETUP_INSTRUCTIONS.md) - System setup guide
- [RBAC.md](RBAC.md) - Role-based access control
- [API.md](API.md) - Complete API reference

---

## ✨ What's New

### Enhanced from Original
- ✅ Automatic token extraction from responses
- ✅ Automatic token extraction from cookies
- ✅ Separate tokens for different users
- ✅ Pre-request scripts for cookie handling
- ✅ Better error messages and logging
- ✅ Comprehensive documentation

### Original Features Preserved
- ✅ Environment variables system
- ✅ All API endpoints
- ✅ Test scripts for ID capture
- ✅ Collection organization

---

## 🎓 Learning Path

```
START HERE
    ↓
Is this your first time?
    ├─ YES → Read POSTMAN_QUICK_REFERENCE.md (5 min)
    └─ NO → Read POSTMAN_SETUP_GUIDE.md

Want to understand flows?
    └─ Read TOKEN_COOKIE_FLOW.md (has diagrams)

Ready to use Postman?
    ├─ Import JSON files
    ├─ Login with Super Admin
    └─ Make API requests

Still have questions?
    └─ Check POSTMAN_SETUP_GUIDE.md → Troubleshooting
```

---

## 📝 Files at a Glance

| File | Purpose | Read Time |
|------|---------|-----------|
| postman_collection.json | API requests + token scripts | - (import) |
| postman_environment.json | Variables + tokens | - (import) |
| POSTMAN_QUICK_REFERENCE.md | Quick start guide | 5 min |
| POSTMAN_SETUP_GUIDE.md | Complete setup guide | 15 min |
| TOKEN_COOKIE_FLOW.md | Visual flow diagrams | 10 min |
| POSTMAN_CONFIG_SUMMARY.md | What changed summary | 3 min |
| POSTMAN.md | Original guide | 5 min |
| API.md | API reference | - (reference) |

---

## 🚀 Next Steps

1. **Choose your starting point** (see table above)
2. **Read the relevant guide** (5-15 minutes)
3. **Import files into Postman** (2 minutes)
4. **Login** (1 minute)
5. **Make requests!** (immediately)

---

**Total time to productive:** 10-20 minutes ⏱️

Enjoy using Postman with automatic token management! 🎉
