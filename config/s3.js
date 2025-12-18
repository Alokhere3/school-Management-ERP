
const AWS = require('aws-sdk');
const multer = require('multer');
let multerS3;
try {
    multerS3 = require('multer-s3');
} catch (e) {
    // multer-s3 may not be installed in minimal dev setups; we'll fallback to memory storage
    multerS3 = null;
}
require('dotenv').config();

// Helper: prefer S3-backed storage only when environment is explicitly configured and multer-s3 is available.
const useS3 = multerS3 && (process.env.S3_BUCKET || process.env.AWS_BUCKET) && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

let s3Client = null;

if (useS3) {
    // multer-s3 v3 expects an AWS SDK v3 S3Client (has a .send method).
    // Prefer using @aws-sdk/client-s3 if available.
    let S3Client;
    try {
        S3Client = require('@aws-sdk/client-s3').S3Client;
    } catch (e) {
        S3Client = null;
    }

    if (S3Client) {
        s3Client = new S3Client({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            },
            // Handle S3-compatible services or specific S3 endpoints
            ...(process.env.S3_ENDPOINT && {
                endpoint: process.env.S3_ENDPOINT,
                forcePathStyle: true
            })
        });

        const upload = multer({
            storage: multerS3({
                s3: s3Client,
                bucket: process.env.S3_BUCKET || process.env.AWS_BUCKET,
                key: (req, file, cb) => {
                    const tenantId = (req.user && (req.user.tenantId || req.user.tenantId)) || 'public';
                    const timestamp = Date.now().toString();
                    // Determine folder based on fieldname
                    let folder = 'students';
                    if (file.fieldname === 'photo') {
                        folder = 'staff';
                    } else if (file.fieldname === 'resume' || file.fieldname === 'joiningLetter') {
                        folder = 'staff/documents';
                    }
                    cb(null, `tenants/${tenantId}/${folder}/${timestamp}_${file.originalname}`);
                }
            }),
            limits: { fileSize: 10 * 1024 * 1024 },
            fileFilter: (req, file, cb) => {
                if (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')) {
                    cb(null, true);
                } else {
                    cb(new Error('Only images and PDFs allowed'), false);
                }
            }
        });

        module.exports = { upload, s3Client };
    } else {
        // Fall back to using v2 client (AWS.S3) wrapped to provide a compatible .send method
        const s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION
        });

        // Wrap v2 client to provide a .send(cmd) that maps to the callback API
        const v2Wrapper = {
            send: (command) => {
                // command is expected to be an AWS SDK v3 command object like PutObjectCommand
                // Map a few common commands we might see (PutObjectCommand, DeleteObjectCommand)
                const name = command && command.constructor && command.constructor.name;
                if (name === 'PutObjectCommand' || name === 'UploadPartCommand' || name === 'CreateMultipartUploadCommand') {
                    // multer-s3 passes params via Upload which in our usage passes params directly — fall back to putObject
                    const params = command.input || command.params || {};
                    return s3.upload(params).promise();
                }
                if (name === 'DeleteObjectCommand') {
                    const params = command.input || command.params || {};
                    return s3.deleteObject(params).promise();
                }
                // As a last resort, reject to indicate unsupported command
                return Promise.reject(new Error('Unsupported command for AWS v2 wrapper: ' + name));
            }
        };

        s3Client = v2Wrapper;

        const upload = multer({
            storage: multerS3({
                s3: v2Wrapper,
                bucket: process.env.S3_BUCKET || process.env.AWS_BUCKET,
                key: (req, file, cb) => {
                    const tenantId = (req.user && (req.user.tenantId || req.user.tenantId)) || 'public';
                    const timestamp = Date.now().toString();
                    // Determine folder based on fieldname
                    let folder = 'students';
                    if (file.fieldname === 'photo') {
                        folder = 'staff';
                    } else if (file.fieldname === 'resume' || file.fieldname === 'joiningLetter') {
                        folder = 'staff/documents';
                    }
                    cb(null, `tenants/${tenantId}/${folder}/${timestamp}_${file.originalname}`);
                }
            }),
            limits: { fileSize: 10 * 1024 * 1024 },
            fileFilter: (req, file, cb) => {
                if (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')) {
                    cb(null, true);
                } else {
                    cb(new Error('Only images and PDFs allowed'), false);
                }
            }
        });

        module.exports = { upload, s3Client };
    }
} else {
    // Fallback: use memory storage so uploads work in dev/tests without S3 configuration.
    // Uploaded files will be available as req.file.buffer for the controller to handle.
    const storage = multer.memoryStorage();
    const upload = multer({
        storage,
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')) {
                cb(null, true);
            } else {
                cb(new Error('Only images and PDFs allowed'), false);
            }
        }
    });

    module.exports = { upload, s3Client };
}

