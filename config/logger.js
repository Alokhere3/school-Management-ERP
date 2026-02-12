/**
 * Simple logger fallback for development.
 * Exports: info, error, warn, debug
 * In production you can replace this with a configured winston instance.
 */
const format = (level, msg) => {
    const ts = new Date().toISOString();
    if (typeof msg === 'object') {
        try {
            msg = JSON.stringify(msg);
        } catch (e) {
            msg = String(msg);
        }
    }
    return `[${ts}] ${level.toUpperCase()}: ${msg}`;
};

module.exports = {
    info: (msg) => console.log(format('info', msg)),
    error: (msg) => console.error(format('error', msg)),
    warn: (msg) => console.warn(format('warn', msg)),
    // Force debug logs for migration monitoring (Phase 0)
    debug: (msg) => {
        const output = format('debug', msg);
        console.log(output); // Always log debug to console during migration
    }
};
