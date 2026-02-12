# Swagger UI Updates

## Summary
The Swagger UI documentation has been updated to reflect the new User Management endpoints and the improved Role Based Access Control (RBAC) system.

## Changes

### 1. User Management Schemas
Added new schemas to `routes/users.js` for better type definitions in the API documentation:
- **User**: Represents a system user with their status, email, and assigned roles.
- **UserRole**: Represents a role assigned to a user, including the role name and ID.

### 2. New User Endpoints
Documented the following new endpoints:
- `GET /api/users`: List all users with pagination and filtering support.
- `GET /api/users/profile`: Get the current logged-in user's profile.
- `GET /api/users/{id}`: Get detailed information for a specific user.
- `PUT /api/users/{id}/roles`: Assign roles to a user.

### 3. Roles and Permissions
The existing Roles documentation in `routes/roles.js` remains valid and covers:
- `Role` schema definition.
- Endpoints for creating, listing, updating, and deleting roles.
- Endpoints for managing fine-grained permissions.

## Accessing Documentation
The updated API documentation is available at `/api-docs` when the server is running. The server automatically generates the Swagger specification from the JSDoc comments in the route files.
