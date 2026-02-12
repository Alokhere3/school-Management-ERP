# Frontend RBAC & User Management Integration Guide

This guide outlines how to integrate the new User Management and Role-Based Access Control (RBAC) APIs into the frontend application.

## 1. Authentication & Context
Ensure the user's profile is loaded on app startup to determine access rights.

- **Endpoint**: `GET /api/users/profile`
- **Use Case**: Store `allowedAccess` and `roles` in global state (Redux/Context).
- **Frontend Logic**:
  - If `allowedAccess` contains `*`, user is Super Admin (grant all).
  - Else, check `allowedAccess` for specific permissions (e.g., `user_management.read`).

## 2. Role Management
Interface for creating and defining roles.

### A. List Roles
- **Endpoint**: `GET /api/roles`
- **Display**: Table showing Role Name, Description, and System status.

### B. Create/Update Role
- **Create**: `POST /api/roles`
  - Body: `{ name, description }`
- **Update**: `PUT /api/roles/:id`
  - Body: `{ name, description }`

### C. Permission Matrix (Core Feature)
A grid UI allowing granular control over what a role can do.

1. **Fetch Modules**: `GET /api/permissions/modules`
   - Returns available system modules (e.g., 'students', 'finance') and actions.
   - *Tip*: Build your table rows dynamically from this response.

2. **Fetch Role Permissions**: `GET /api/roles/:id/permissions`
   - Returns current permission assignments for the role.

3. **Update Permissions**:
   - **Bulk (Recommended)**: `PUT /api/roles/:id/permissions`
     - Body: `{ permissions: [{ module: 'students', actions: { read: 'full', create: 'limited' } }] }`
   - **Toggle Single**: `PUT /api/roles/:id/permissions/:module/:action`

## 3. User Management
Interface for managing system users and their access.

### A. List Users
- **Endpoint**: `GET /api/users?page=1&limit=10&search=...`
- **Display**: Table with Email, Status, and **Assigned Roles**.

### B. Assign Roles to User
- **Endpoint**: `PUT /api/users/:userId/roles`
- **Body**: `{ "roleIds": ["UUID_STRING"] }`
- **UI**: Multi-select dropdown in User Edit modal, populated by `GET /api/roles`.

## 4. Frontend Route Protection
Protect client-side routes based on the permissions loaded in Step 1.

```javascript
// Example helper function
const canAccess = (userPermissions, module, action) => {
  if (userPermissions.includes('*')) return true; // Super Admin
  const permission = userPermissions.find(p => p.resource === module);
  return permission && permission.actions.includes(action);
};

// Usage in Route Guard
if (!canAccess(user.allowedAccess, 'user_management', 'read')) {
  return <Redirect to="/unauthorized" />;
}
```

## 5. Quick Reference API List

| Feature | Method | Endpoint | Description |
|---------|--------|----------|-------------|
| **Profile** | GET | `/api/users/profile` | Get current user permissions |
| **Users** | GET | `/api/users` | List users |
| **Users** | PUT | `/api/users/:id/roles` | Assign role to user |
| **Roles** | GET | `/api/roles` | List all roles |
| **Roles** | POST | `/api/roles` | Create new role |
| **Perms** | GET | `/api/permissions/modules` | Get all available modules |
| **Perms** | GET | `/api/roles/:id/permissions` | Get permissions for role |
| **Perms** | PUT | `/api/roles/:id/permissions` | Update permissions |
