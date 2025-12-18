/**
 * extractKeyFromUrl(s3Url)
 * Parses an S3 object URL and extracts the key.
 * Example: "https://my-bucket.s3.us-east-1.amazonaws.com/tenants/123/photo.jpg" => "tenants/123/photo.jpg"
 */
function extractKeyFromUrl(s3Url) {
    if (!s3Url || typeof s3Url !== 'string') return null;
    try {
        // Try to match s3 URL patterns like:
        // https://bucket.s3.region.amazonaws.com/key
        // https://s3.region.amazonaws.com/bucket/key
        // https://bucket.s3.amazonaws.com/key
        const url = new URL(s3Url);
        let key = null;

        // Pattern 1: bucket.s3.region.amazonaws.com/key
        if (url.hostname.includes('.s3.') && url.hostname.includes('.amazonaws.com')) {
            key = url.pathname.substring(1); // remove leading slash
        }
        // Pattern 2: s3.region.amazonaws.com/bucket/key
        else if (url.hostname.startsWith('s3') && url.hostname.includes('.amazonaws.com')) {
            const parts = url.pathname.substring(1).split('/'); // remove leading slash and split
            if (parts.length > 1) key = parts.slice(1).join('/');
        }

        return key || null;
    } catch (e) {
        return null;
    }
}

/**
 * buildProxyUrl(key, baseUrl)
 * Returns a proxy URL that will be served through the backend's /images/:key endpoint
 * Example: buildProxyUrl("tenants/123/photo.jpg") => "http://localhost:3000/images/tenants/123/photo.jpg"
 * 
 * If BACKEND_URL env var is set, uses that (for production)
 * Otherwise constructs from NODE_ENV and PORT (for development)
 */
function buildProxyUrl(key, baseUrl) {
    if (!key) return null;
    
    // If no baseUrl provided, construct from env vars
    if (!baseUrl) {
        if (process.env.BACKEND_URL) {
            baseUrl = process.env.BACKEND_URL;
        } else {
            // Development: use localhost with actual PORT
            const port = process.env.PORT || 3000;
            baseUrl = `http://localhost:${port}`;
        }
    }
    
    // Ensure no double slashes
    const cleanBase = baseUrl.replace(/\/$/, '');
    return `${cleanBase}/images/${key}`;
}

module.exports = { extractKeyFromUrl, buildProxyUrl };
