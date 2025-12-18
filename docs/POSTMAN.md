# Postman - School ERP API

This short guide explains how to import and use the Postman collection shipped with this repository.

Files provided:
- `docs/postman_collection.json` — Postman collection (v2.1) containing useful requests (Auth + Students onboarding).

Quick steps

1. Start the backend server locally (example):

```powershell
cd "I:\Git Repos\school-erp-full-structure"
npm run dev
```

2. Open Postman and import the collection:
- In Postman: `File` → `Import` → Select `docs/postman_collection.json` or drag-and-drop it.

3. Create an environment and set variables (recommended):
- `baseUrl` → `http://localhost:3000` (or your deployed base URL)
- `token` → (leave empty for now)
- `tenantId` → (optional)
- `studentId` → (used after creating a student via onboarding)

4. Use the `Auth / Login` request to authenticate:
- Send the `Login` request with valid credentials (e.g., `admin@example.com` / `password` if seeded).
- Copy the returned `token` (response `token`) and paste into the environment variable `token` OR use Postman Tests to automatically set it.

Optional Test Script (set JWT automatically)

In the `Login` request, add this script in the `Tests` tab to auto-populate the environment variable `token`:

```javascript
const res = pm.response.json();
if (res && res.token) {
  pm.environment.set('token', res.token);
  console.log('Token saved to environment variable: token');
}
```

5. Call protected endpoints
- Ensure `Authorization` header uses `Bearer {{token}}` (this is set in the collection requests).
- Use `Start Onboarding` to create a student. Copy the returned `id` and set `studentId` variable.
- Use `Update Onboarding` to progress the onboarding flow using `{{studentId}}`.

Automatic extraction of IDs
- The collection includes test scripts that automatically save commonly used IDs into your environment:
  - `token` and `tenantId` are saved by the `Auth -> Login` test script when present in the response.
  - `tenantId` is also saved by `Tenants -> Create Tenant` and attempted to be saved by `Auth -> Register` if the response contains it.
  - `roleId` is saved by `Roles -> Create Role`.
  - `userId` is saved by `Users -> Create User`.

After running these create requests, the corresponding environment variables will be populated and can be used in subsequent requests (for example `{{tenantId}}`, `{{roleId}}`, `{{userId}}`).

Notes
- The collection uses a small subset of endpoints focused on onboarding flows. You can expand it by importing `docs/swagger.json` directly into Postman (Postman supports OpenAPI imports) to get all endpoints and schemas.
- If your backend is behind a reverse proxy or runs on a different port, change `baseUrl` accordingly.

If you want, I can:
- Add more example requests (users, roles, tenants, RBAC tests).
- Add Postman environment JSON that pre-creates an environment for easier import.
- Automatically set the `tenantId` & `studentId` from responses in request tests.

