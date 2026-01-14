const express = require('express');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/s3');
const logger = require('../config/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @openapi
 * /images/{key}:
 *   get:
 *     tags:
 *       - Images
 *     summary: Proxy endpoint to stream images from S3
 *     description: Proxy endpoint to stream images from S3 without exposing S3 URLs
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: The S3 object key (stored in DB as photoKey). Can contain slashes (e.g., tenants/123/students/photo.jpg)
 *     responses:
 *       200:
 *         description: Image stream from S3
 *       400:
 *         description: Invalid image key
 *       404:
 *         description: Image not found
 *       500:
 *         description: Failed to retrieve image
 */

/**
 * GET /images/:key
 * Proxy endpoint to stream images from S3 without exposing S3 URLs
 *
 * @param {string} key - The S3 object key (stored in DB as photoKey)
 *                       Can contain slashes (e.g., tenants/123/students/photo.jpg)
 * @returns {Stream} Image stream from S3
 *
 * Example: GET /images/tenants/123/students/photo.jpg
 */
router.get(/(.+)/, authenticateToken, async (req, res) => {
    // Get the full path (everything after /images/)
    let key = req.params[0];

    // Trim leading slashes if any (regex might capture them)
    key = key.replace(/^\/+/, '');

    // Basic validation: key should not contain path traversal
    if (!key || key.includes('..')) {
        logger.warn('Invalid image key detected:', key);
        return res.status(400).json({ message: 'Invalid image key' });
    }

    // Enforce authentication and tenant isolation before any S3 operation
    const user = req.user || req.userContext;
    if (!user || !user.tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    const expectedPrefix = `tenants/${user.tenantId}/`;
    if (!key.startsWith(expectedPrefix)) {
        logger.warn(`[images] Tenant isolation failure: requested key ${key} does not belong to tenant ${user.tenantId}`);
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        logger.debug('Image proxy request for key:', key);
        
        if (!s3Client) return res.status(503).json({ message: 'S3 not configured' });
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET || process.env.AWS_BUCKET,
            Key: key,
        });

        const response = await s3Client.send(command);

        // Set content type from S3 metadata or default to image/jpeg
        // Set content type from S3 metadata or infer from file extension
        const s3ContentType = response.ContentType || '';
        const path = require('path');
        const ext = path.extname(key || '').toLowerCase();
        const extToMime = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml'
        };
        let contentType = s3ContentType && s3ContentType !== 'application/octet-stream' ? s3ContentType : (extToMime[ext] || 'image/jpeg');
        res.setHeader('Content-Type', contentType);
        // Ensure browsers render inline instead of forcing download
        res.setHeader('Content-Disposition', 'inline');
    // Prevent browser caching to ensure fresh images
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    // Allow cross-origin embedding of images when appropriate.
    // Helmet may set Cross-Origin-Resource-Policy: same-origin which blocks embedding from a different origin.
    // Override it for this route so test pages or other frontends can embed the image.
    // For production, consider restricting this to specific origins instead of '*'.
    res.setHeader('Cross-Origin-Resource-Policy', process.env.IMAGE_CROSS_ORIGIN || 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', process.env.IMAGE_CORS_ORIGIN || '*');
    // If you need credentials (cookies) with cross-origin requests, set Access-Control-Allow-Credentials accordingly.

        // Stream directly from S3 to response
        response.Body.pipe(res);
    } catch (err) {
        logger.error('Image proxy error for key', key, ':', err.message);
        logger.error('Error code:', err.Code);
        logger.error('Full error:', err);

        if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
            return res.status(404).json({ message: 'Image not found' });
        }

        // Log detailed error for debugging
        const errorDetails = {
            message: 'Failed to retrieve image',
            error: err.message,
            code: err.Code,
            bucket: process.env.S3_BUCKET || process.env.AWS_BUCKET,
            key: key
        };
        
        res.status(500).json(errorDetails);
    }
});

module.exports = router;
