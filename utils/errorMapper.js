/**
 * Centralized error mapping to client-friendly HTTP status codes and JSON shapes.
 * Keep mappings minimal and deterministic so clients can rely on `code` values.
 */
const mapSequelizeUnique = (err) => {
    const field = err.errors && err.errors[0] && (err.errors[0].path || err.errors[0].field);
    const message = field ? `${field} already exists` : 'Duplicate value';
    const code = (field && field.toLowerCase().includes('email')) ? 'EMAIL_TAKEN' : 'DUPLICATE_VALUE';
    return { status: 409, body: { success: false, error: message, code } };
};

const mapSequelizeValidation = (err) => {
    const messages = err.errors ? err.errors.map(e => e.message) : [err.message || 'Validation failed'];
    return { status: 400, body: { success: false, error: 'Validation error', code: 'VALIDATION_ERROR', details: messages } };
};

function mapError(err) {
    if (!err) return { status: 500, body: { success: false, error: 'Unknown error', code: 'SERVER_ERROR' } };
    if (err.name === 'SequelizeUniqueConstraintError') return mapSequelizeUnique(err);
    if (err.name === 'SequelizeValidationError') return mapSequelizeValidation(err);

    // Allow an Error-like object with status/body (for manual mapping)
    if (err.status && err.body) return { status: err.status, body: err.body };

    // Fallback: internal server error
    return { status: 500, body: { success: false, error: err.message || 'Internal server error', code: 'SERVER_ERROR' } };
}

function sendError(res, err, fallbackMessage) {
    const mapped = mapError(err);
    // If fallbackMessage provided and mapped is 500, prefer a non-sensitive fallback message
    if (mapped.status === 500 && fallbackMessage) mapped.body.error = fallbackMessage;
    // Log server-side errors for diagnostics
    if (mapped.status >= 500) {
        // eslint-disable-next-line no-console
        console.error('Internal error:', err && (err.stack || err));
    }
    return res.status(mapped.status).json(mapped.body);
}

module.exports = { mapError, sendError };
