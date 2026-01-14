
require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const logger = require('./logger');

// Environment-driven S3 configuration
const BUCKET = process.env.S3_BUCKET || process.env.AWS_BUCKET || null;
const REGION = process.env.AWS_REGION || 'ap-south-1';

let s3Client = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && BUCKET) {
    s3Client = new S3Client({
        region: REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true })
    });
    logger.info('[config/s3] S3 client configured');
} else {
    logger.warn('[config/s3] S3 not fully configured - s3Client=null (local/dev mode)');
}

// Memory multer storage for dev and for endpoints that accept multipart bodies
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/avif', 'application/pdf'
        ];
        if (!file || !file.mimetype) return cb(new Error('Invalid file'), false);
        if (allowedMimes.includes(file.mimetype.toLowerCase())) return cb(null, true);
        return cb(new Error('Invalid file type'), false);
    }
});

async function uploadBufferToS3(s3ClientInstance, bucket, key, buffer, contentType) {
    if (!s3ClientInstance) throw new Error('S3 client not configured');
    if (!bucket) throw new Error('S3 bucket not configured');
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream'
    });
    return s3ClientInstance.send(command);
}

module.exports = {
    upload,
    s3Client,
    bucket: BUCKET,
    uploadBufferToS3
};

