const client = require('prom-client');
const crypto = require('node:crypto');
const { getRequestContext } = require('../core/requestContext');
const { readBackupHealth } = require('../services/backupHealthService');

client.collectDefaultMetrics({
    prefix: 'ikbenimle_'
});

const httpDuration = new client.Histogram({
    name: 'ikbenimle_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

const backupAge = new client.Gauge({
    name: 'ikbenimle_backup_age_seconds',
    help: 'Age of the latest successful backup in seconds'
});

const backupHealthy = new client.Gauge({
    name: 'ikbenimle_backup_healthy',
    help: 'Whether the latest backup is successful and younger than the allowed threshold'
});

const slowQueryDuration = new client.Histogram({
    name: 'ikbenimle_slow_query_duration_seconds',
    help: 'Slow database query duration by endpoint and stable query fingerprint',
    labelNames: ['operation', 'endpoint', 'query_fingerprint'],
    buckets: [0.25, 0.5, 0.8, 1, 2, 5, 10]
});

const observeSlowQuery = (operation, sql, durationMs) => {
    const context = getRequestContext();
    const queryFingerprint = crypto.createHash('sha256')
        .update(String(sql || '').replace(/\s+/g, ' ').trim())
        .digest('hex')
        .slice(0, 16);
    slowQueryDuration.observe({
        operation,
        endpoint: context.endpoint || 'background',
        query_fingerprint: queryFingerprint
    }, durationMs / 1000);
    return { ...context, query_fingerprint: queryFingerprint };
};

const setBackupMetrics = ({ healthy, age_seconds: ageSeconds }) => {
    backupHealthy.set(healthy ? 1 : 0);
    if (Number.isFinite(ageSeconds)) backupAge.set(ageSeconds);
};

const normalizeRoute = (req) => {
    if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}`;
    if (req.baseUrl) return req.baseUrl;
    return 'unmatched';
};

const metricsMiddleware = (req, res, next) => {
    const end = httpDuration.startTimer();
    res.once('finish', () => {
        end({
            method: req.method,
            route: normalizeRoute(req),
            status_code: String(res.statusCode)
        });
    });
    next();
};

const metricsHandler = async (_req, res, next) => {
    try {
        setBackupMetrics(await readBackupHealth());
        res.setHeader('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    } catch (error) {
        next(error);
    }
};

const metricsAccess = (req, res, next) => {
    if (process.env.METRICS_ENABLED !== 'true') {
        return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const expectedToken = String(process.env.METRICS_TOKEN || '');
    const authorization = String(req.get('authorization') || '');
    const suppliedToken = authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : '';
    if (!expectedToken || !suppliedToken) {
        return res.status(401).json({ error: 'METRICS_AUTH_REQUIRED' });
    }

    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
        return res.status(403).json({ error: 'METRICS_AUTH_INVALID' });
    }
    return next();
};

module.exports = {
    metricsMiddleware,
    metricsHandler,
    metricsAccess,
    setBackupMetrics,
    observeSlowQuery
};
