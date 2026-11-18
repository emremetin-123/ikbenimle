const { performance } = require('node:perf_hooks');
const { observeSlowQuery } = require('../middleware/metrics');

const instrumentDatabase = (db, options = {}) => {
    const thresholdMs = Number(options.thresholdMs || process.env.SLOW_QUERY_MS || 500);
    const log = options.log || ((entry) => console.warn(JSON.stringify(entry)));

    const timed = async (operation, sql, work) => {
        const startedAt = performance.now();
        try {
            return await work();
        } finally {
            const durationMs = performance.now() - startedAt;
            if (durationMs >= thresholdMs) {
                const context = observeSlowQuery(operation, sql, durationMs);
                log({
                    level: 'warn',
                    event: 'slow_database_query',
                    operation,
                    duration_ms: Number(durationMs.toFixed(1)),
                    endpoint: context.endpoint || 'background',
                    request_id: context.request_id,
                    query_fingerprint: context.query_fingerprint
                });
            }
        }
    };

    return {
        get: (sql, params = []) => timed('get', sql, () => db.get(sql, params)),
        all: (sql, params = []) => timed('all', sql, () => db.all(sql, params)),
        run: (sql, params = []) => timed('run', sql, () => db.run(sql, params)),
        exec: (sql) => timed('exec', sql, () => db.exec(sql)),
        close: () => db.close(),
        transaction: (work) => db.transaction((tx) => work(instrumentDatabase(tx, { thresholdMs, log })))
    };
};

module.exports = {
    instrumentDatabase
};
