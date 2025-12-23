Postman / Newman Runner for School ERP API

This document explains how to run the Postman collection smoke tests using Postman Runner or Newman (CLI).

Files in this folder:
- `postman_smoke_collection.json` - collection with request-level tests (smoke tests)
- `postman_generated_environment.json` - environment with `baseUrl`, `token`, and example credentials

Run via Postman GUI
1. Open Postman.
2. Import `postman_smoke_collection.json` and `postman_generated_environment.json`.
3. Select the environment `School ERP Local` from the environment dropdown.
4. Use the Collection Runner (Runner button) to run the collection. Optionally set iterations to 1.

Run via Newman (CLI)
1. Install newman (if not installed):

PowerShell
```powershell
npm install -g newman
```

2. Run the collection with the environment file:

PowerShell
```powershell
newman run docs/postman_smoke_collection.json -e docs/postman_generated_environment.json --timeout-request 120000
```

Notes
- Ensure the backend server is running and reachable at `{{baseUrl}}` (default `http://localhost:3000`).
- The login request attempts to save a token to the environment variable `token` that is used by protected requests. If your API returns the token under a different property name (e.g., `accessToken`, or nested `data.token`), the collection's login test already attempts to handle `token`, `accessToken`, and `data.token`.
- If `Auth - Register With Roles` requires a Super Admin token to assign `School Admin`, provide a proper `token` value in the environment (log in as Super Admin first).
- For CI, you can add a step to install `newman` and run the command above. The CLI returns a non-zero exit code when tests fail, which is useful for pipelines.

Troubleshooting
- If responses are not JSON, some tests will log 'Non-JSON response'. Inspect the raw response in Postman to adapt tests to your API's exact response shapes.
- To capture more output with Newman, add `--reporters cli,json` and specify an output file.

If you want, I can add a `npm` script to run newman (and add `newman` to `devDependencies`) so you can run `npm run postman:smoke` — tell me if you'd like that and I will add it.
