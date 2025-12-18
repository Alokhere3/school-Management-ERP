// Simple express error handler - logs and responds with JSON error
const logger = require('../config/logger');

module.exports = (err, req, res, next) => {
	logger.error(err && err.message ? err.message : err);
	const status = err.status || 500;
	res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
};
