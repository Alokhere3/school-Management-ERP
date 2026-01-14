const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const logger = require('../config/logger');

const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'svg', 'avif'];

function validateExtensionForCategory(filename, category) {
    const ext = (path.extname(filename) || '').replace('.', '').toLowerCase();
    if (!ext) return false;
    if (category === 'profile') return ALLOWED_IMAGE_EXTS.includes(ext);
    // allow pdfs for document categories
    if (category === 'resume' || category === 'joining_letter' || category === 'documents') return ext === 'pdf' || ALLOWED_IMAGE_EXTS.includes(ext);
    return ALLOWED_IMAGE_EXTS.includes(ext);
}

/**
 * extractKeyFromUrl(s3Url)
 * Parses an S3 object URL and extracts the key.
 * Example: "https://my-bucket.s3.us-east-1.amazonaws.com/tenants/123/photo.jpg" => "tenants/123/photo.jpg"
 */
function extractKeyFromUrl(s3Url) {
    if (!s3Url || typeof s3Url !== 'string') return null;
    try {
        const url = new URL(s3Url);
        let key = null;

        if (url.hostname.includes('.s3.') && url.hostname.includes('.amazonaws.com')) {
            key = url.pathname.substring(1);
        } else if (url.hostname.startsWith('s3') && url.hostname.includes('.amazonaws.com')) {
            const parts = url.pathname.substring(1).split('/');
            if (parts.length > 1) key = parts.slice(1).join('/');
        }

        return key || null;
    } catch (e) {
        return null;
    }
}

/**
 * generateS3Key(tenantId, entity, entityId, category, filename)
 * Generates a properly scoped S3 object key for SaaS multi-tenant isolation
 * 
 * Format: tenants/{tenantId}/{entity}/{entityId}/{category}/{uuid}.{ext}
 * 
 * @param {String} tenantId - Tenant UUID
 * @param {String} entity - Entity type (students, teachers, staff, etc.)
 * @param {String} entityId - Entity record UUID
 * @param {String} category - File category (profile, resume, documents, etc.)
 * @param {String} filename - Original filename
 * @returns {String} S3 object key
 * 
 * Example:
 * generateS3Key("tenant-uuid", "teachers", "teacher-uuid", "profile", "photo.jpg")
 * => "tenants/tenant-uuid/teachers/teacher-uuid/profile/abc123-uuid.jpg"
 */
function generateS3Key(tenantId, entity, entityId, category, filename) {
    if (!tenantId || !entity || !entityId || !category || !filename) {
        throw new Error('All parameters required: tenantId, entity, entityId, category, filename');
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ext) {
        throw new Error(`Invalid filename: must have extension (${filename})`);
    }

    const fileUuid = uuidv4();
    return `tenants/${tenantId}/${entity}/${entityId}/${category}/${fileUuid}${ext}`;
}

/**
 * generatePresignedPutUrl(s3Client, bucket, key, contentType, expiresIn)
 * Generates a presigned PUT URL for direct client-to-S3 upload
 */
async function generatePresignedPutUrl(s3Client, bucket, key, contentType = 'application/octet-stream', expiresIn = 3600) {
    try {
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        logger.debug(`[generatePresignedPutUrl] Generated PUT URL for key: ${key}, expires: ${expiresIn}s`);
        return signedUrl;
    } catch (err) {
        logger.error(`[generatePresignedPutUrl] Failed to generate PUT URL for key ${key}:`, err.message);
        throw err;
    }
}

/**
 * generatePresignedGetUrl(s3Client, bucket, key, expiresIn)
 * Generates a presigned GET URL for time-limited file access
 */
async function generatePresignedGetUrl(s3Client, bucket, key, expiresIn = 900) {
    try {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        logger.debug(`[generatePresignedGetUrl] Generated GET URL for key: ${key}, expires: ${expiresIn}s`);
        return signedUrl;
    } catch (err) {
        logger.error(`[generatePresignedGetUrl] Failed to generate GET URL for key ${key}:`, err.message);
        throw err;
    }
}

/**
 * deleteS3Object(s3Client, bucket, key, tenantId, auditContext)
 * Safely deletes an object from S3 with audit logging
 */
async function deleteS3Object(s3Client, bucket, key, tenantId, auditContext = {}) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        await s3Client.send(command);
        logger.info(`[deleteS3Object] ✅ Deleted S3 object`, {
            tenantId,
            bucket,
            key,
            deletedBy: auditContext.userId || 'system',
            action: auditContext.action || 'unknown',
            entityId: auditContext.entityId,
            entityType: auditContext.entityType,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        if (err.Code !== 'NoSuchKey') {
            logger.warn(`[deleteS3Object] Failed to delete S3 object ${key}:`, err.message);
        } else {
            logger.debug(`[deleteS3Object] Object already deleted or never existed: ${key}`);
        }
    }
}

/**
 * buildProxyUrl(key, baseUrl)
 * Returns a proxy URL for backend image streaming via /images/:key endpoint
 */
function buildProxyUrl(key, baseUrl) {
    if (!key) return null;
    
    if (!baseUrl) {
        if (process.env.BACKEND_URL) {
            baseUrl = process.env.BACKEND_URL;
        } else {
            const port = process.env.PORT || 3000;
            baseUrl = `http://localhost:${port}`;
        }
    }
    
    const cleanBase = baseUrl.replace(/\/$/, '');
    return `${cleanBase}/images/${key}`;
}

module.exports = {
    extractKeyFromUrl,
    generateS3Key,
    generatePresignedPutUrl,
    generatePresignedGetUrl,
    deleteS3Object,
    buildProxyUrl,
    validateExtensionForCategory,
    ALLOWED_IMAGE_EXTS
};
