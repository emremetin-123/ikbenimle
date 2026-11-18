class AppError extends Error {
    constructor(status, code, message = code, details = undefined) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

const notFound = (code, message = code) => {
    throw new AppError(404, code, message);
};

module.exports = {
    AppError,
    asyncHandler,
    notFound
};
