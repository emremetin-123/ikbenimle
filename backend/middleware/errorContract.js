const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

const errorContractMiddleware = (req, res, next) => {
    const sendJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode < 400 || !body || typeof body !== 'object' || Array.isArray(body)) {
            return sendJson(body);
        }

        const rawError = typeof body.error === 'string' ? body.error : '';
        const code = CODE_PATTERN.test(rawError)
            ? rawError
            : (res.statusCode === 400 ? 'BAD_REQUEST' : 'REQUEST_FAILED');
        const message = body.message
            || (rawError && rawError !== code ? rawError : 'İstek tamamlanamadı.');

        return sendJson({
            error: code,
            message,
            ...(body.details === undefined ? {} : { details: body.details }),
            request_id: body.request_id || req.id
        });
    };
    next();
};

module.exports = { errorContractMiddleware };
