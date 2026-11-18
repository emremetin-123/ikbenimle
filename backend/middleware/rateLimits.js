const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const jsonHandler = (_req, res) => {
    res.status(429).json({ error: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.' });
};

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    // Employees commonly share one public IP behind the company gateway.
    // Keep abuse protection without throttling the whole workplace as one user.
    limit: Number(process.env.API_RATE_LIMIT_5M || 30000),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonHandler
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.employee_id || '').trim().toLowerCase()}`,
    handler: jsonHandler
});

const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // Successful logins are removed from the counter. The higher ceiling avoids
    // rejecting a shift change where many employees share the same NAT address.
    limit: Number(process.env.LOGIN_IP_RATE_LIMIT_15M || 500),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: jsonHandler
});

const publicVerifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonHandler
});

const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user?.id || ipKeyGenerator(req.ip)}`,
    handler: jsonHandler
});

const integrationLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.INTEGRATION_RATE_LIMIT_PER_MINUTE || 600),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `integration:${req.integration?.apiKeyId || ipKeyGenerator(req.ip)}`,
    handler: jsonHandler
});

module.exports = {
    apiLimiter,
    loginLimiter,
    loginIpLimiter,
    publicVerifyLimiter,
    aiLimiter,
    integrationLimiter
};
