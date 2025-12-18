const express = require('express');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const app = express();
const port = process.env.DOCS_PORT || 4000;

// If the main application is already serving /api-docs on the app port, prefer that
// so Swagger is available on the same port as the app. Check app port (process.env.PORT or 3000).
const appPort = process.env.PORT || 3000;
const http = require('http');

function checkMainAppDocs(cb) {
  const opts = {
    hostname: 'localhost',
    port: appPort,
    path: '/api-docs',
    method: 'GET',
    timeout: 1000
  };

  const req = http.request(opts, (res) => {
    cb(null, res.statusCode);
  });
  req.on('error', (e) => cb(e));
  req.on('timeout', () => { req.destroy(); cb(new Error('timeout')); });
  req.end();
}

let swaggerDoc = null;
try {
  swaggerDoc = require(path.join(__dirname, '..', 'docs', 'swagger.json'));
} catch (e) {
  console.warn('No static docs/swagger.json found locally. If your app provides docs at /api-docs, you can open that.');
}

checkMainAppDocs((err, status) => {
  if (!err && status && status >= 200 && status < 400) {
    console.log(`Main app appears to be serving API docs at http://localhost:${appPort}/api-docs — no separate docs server started.`);
    process.exit(0);
  }

  // If main app not available or not serving docs, fall back to serving local docs (if present)
  if (swaggerDoc) {
    app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    console.log('Serving Swagger UI at http://localhost:' + port);
  } else {
    app.get('/', (req, res) => res.send('No API docs available. Run `npm run docs:generate` and start the app to serve docs at /api-docs'));
  }

  app.listen(port, () => {});
});
