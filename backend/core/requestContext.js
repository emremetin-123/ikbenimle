const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

const requestContextMiddleware = (req, _res, next) => {
    storage.run({
        request_id: req.id,
        method: req.method,
        endpoint: String(req.path || '/')
            .replace(/\/\d+(?=\/|$)/g, '/:id')
            .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':uuid')
    }, next);
};

const getRequestContext = () => storage.getStore() || {};

module.exports = { requestContextMiddleware, getRequestContext };
