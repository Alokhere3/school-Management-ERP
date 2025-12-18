// Small helper to wrap async route handlers and forward errors to express error handler
module.exports = fn => {
    const wrapper = (req, res, next) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };
    // Return the promise so tests can await it
    return wrapper;
};
