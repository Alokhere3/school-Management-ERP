#!/usr/bin/env node

/**
 * System Initialization Guide
 * 
 * This document explains the complete setup process for the School ERP system
 * and how to create different role hierarchies.
 */

const chalk = require('chalk');

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                      SCHOOL ERP - SETUP GUIDE                             ║
╚════════════════════════════════════════════════════════════════════════════╝

📋 INITIALIZATION STEPS:

1. SEED RBAC ROLES AND PERMISSIONS
   This creates all the roles (Super Admin, School Admin, Teacher, etc.)
   and their permission mappings.
   
   Command: node scripts/seedRBAC.js
   
   ✓ Creates 12 system roles
   ✓ Creates 100+ permission entries
   ✓ Maps 343+ role-permission relationships

2. CREATE SUPER ADMIN USER
   Creates the initial super admin user that can manage tenants and create
   School Admin users.
   
   Command: node scripts/CreateAdminWithAlok.js
   
   Default Credentials:
   - Email: alokhere3@gmail.com
   - Password: Alok@1234
   
   Note: You can override these with environment variables:
   - SUPER_ADMIN_EMAIL
   - SUPER_ADMIN_PASSWORD

3. CREATE SCHOOL ADMIN (via API)
   Once you have the Super Admin user, you can create a School Admin
   through the tenant registration API endpoint.
   
   Endpoint: POST /api/auth/register
   
   Request Body:
   {
     "name": "Your School Name",
     "email": "admin@school.com", 
     "password": "SecurePassword123!",
     "roles": ["School Admin"],
     "authenticated": true,
     "userId": "<super-admin-user-id>"
   }
   
   Headers:
   - Authorization: Bearer <super-admin-jwt-token>
   - Content-Type: application/json

═══════════════════════════════════════════════════════════════════════════════

🔑 ROLE HIERARCHY:

┌─────────────────────────────────────────────────────────────────────────┐
│ SYSTEM ROLES (Super Admin & Support Engineer)                           │
├─────────────────────────────────────────────────────────────────────────┤
│ • Super Admin - Cross-tenant system administrator (SaaS)               │
│ • Support Engineer - SaaS support staff with cross-tenant access       │
└─────────────────────────────────────────────────────────────────────────┘
         ↓
         Can create tenants and School Admin users
         ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ TENANT ROLES (Per-tenant administration)                               │
├─────────────────────────────────────────────────────────────────────────┤
│ • School Admin - Full control over one tenant/school                  │
│ • Principal - Academic and admin oversight                             │
│ • Teacher - Class and student management                              │
│ • Accountant - Finance and fees management                            │
│ • HR Manager - Staff and payroll management                           │
│ • Librarian - Library management                                      │
│ • Transport Manager - Transport logistics                             │
│ • Hostel Warden - Hostel management                                   │
│ • Parent - Limited access to child's records                          │
│ • Student - Access to own records and LMS                             │
└─────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

✅ COMPLETE SETUP COMMAND:

To run both steps sequentially:

  node scripts/seedRBAC.js && node scripts/CreateAdminWithAlok.js

═══════════════════════════════════════════════════════════════════════════════
`);

// Check if chalk is available
try {
    require('chalk');
} catch (e) {
    console.log('(chalk library not available - output without colors)');
}
