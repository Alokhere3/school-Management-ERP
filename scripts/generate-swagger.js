const fs = require('fs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: { 
      title: 'School ERP API', 
      version: '2.0.0',
      description: 'School Management System API with RBAC and secure cookie-based authentication',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.yourschool.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token in Authorization header (backward compatibility)'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
          description: 'JWT access token stored in HTTP-only cookie (recommended)'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message'
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE'
            },
            details: {
              type: 'array',
              items: {
                type: 'object'
              }
            }
          }
        },
        Staff: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string' },
            department: { type: 'string' },
            designation: { type: 'string' },
            gender: { type: 'string', enum: ['Male', 'Female', 'Other'] },
            primaryContactNumber: { type: 'string' },
            dateOfBirth: { type: 'string', format: 'date' },
            dateOfJoining: { type: 'string', format: 'date' },
            status: { type: 'string', enum: ['active', 'inactive', 'terminated'] },
            photoUrl: { type: 'string', format: 'uri' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [
      { bearerAuth: [] },
      { cookieAuth: [] }
    ],
    tags: [
      { name: 'Auth', description: 'Authentication and authorization endpoints' },
      { name: 'Students', description: 'Student management endpoints' },
      { name: 'Staff', description: 'Staff (HR) management endpoints' },
      { name: 'Tenants', description: 'Tenant management endpoints' },
      { name: 'Roles', description: 'Role and permission management' },
      { name: 'Images', description: 'Image proxy endpoints' }
    ]
  },
  apis: [path.join(__dirname, '..', 'routes', '*.js'), path.join(__dirname, '..', 'models', '*.js')]
};

const outputPath = path.join(__dirname, '..', 'docs', 'swagger.json');

async function generate() {
  try {
    // Don't use existing swagger.json as base - generate fresh from JSDoc
    const spec = swaggerJSDoc({
      ...options,
      definition: options.definition // Use the definition from options, not from existing file
    });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf8');
    console.log('✅ Generated swagger.json at', outputPath);
    console.log(`   - API Version: ${spec.info.version}`);
    console.log(`   - Security Schemes: ${Object.keys(spec.components.securitySchemes).join(', ')}`);
    console.log(`   - Tags: ${spec.tags.map(t => t.name).join(', ')}`);
  } catch (err) {
    console.error('❌ Failed to generate swagger:', err);
    process.exit(1);
  }
}

generate();
