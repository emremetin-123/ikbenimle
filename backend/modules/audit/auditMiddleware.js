const crypto = require('node:crypto');
const { AppError } = require('../../core/http');
const { createAuditRepository } = require('./auditRepository');
const { classify, safeDetails, stamp } = require('./auditPolicy');

const createAuditMiddleware = db => {
    const repository = createAuditRepository(db);
    const pending = new Set();
    const track = promise => {
        pending.add(promise);
        void promise.finally(() => pending.delete(promise));
    };
    const middleware = (req, res, next) => {
        const policy = classify(req);
        if (!policy) return next();
        let id = null;
        let before = null;
        let result = {};
        let finished = false;
        const start = async user => {
            if (id) return;
            const eventId = crypto.randomUUID();
            const path = String(req.originalUrl).split('?')[0];
            try {
                before = req.method !== 'GET' ? await repository.snapshot(path, user || {}) : null;
                await repository.insert({ id: eventId, created_at: stamp(Date.now()), actor_id: user?.id || null,
                    actor_name: user?.name?.slice(0, 255) || null, actor_employee_id: user?.employee_id?.slice(0, 100) || null,
                    ...policy, retention_days: 365, ip_address: String(req.ip || '').slice(0, 100),
                    request_id: /^[a-f0-9-]{36}$/i.test(req.id || '') ? req.id : null, details: JSON.stringify(before ? { before } : {}) });
                id = eventId;
                req.auditEventId = eventId;
            } catch {
                req.log?.error({ code: 'AUDIT_START_FAILED' }, 'Audit storage unavailable; protected operation blocked');
                throw new AppError(503, 'AUDIT_UNAVAILABLE', 'İşlem günlüğü şu anda kaydedilemiyor. Lütfen tekrar deneyin.');
            }
        };
        req.auditStart = start;
        const originalJson = res.json;
        res.json = function (body) {
            if (body && typeof body === 'object') {
                result = {
                    error_code: typeof body.error === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(body.error) ? body.error : undefined,
                    resource_id: [body.id, body.videoId, body.assignmentId].find(value => Number.isSafeInteger(value) && value > 0)?.toString(),
                    level_value: Number.isInteger(body.level_value) && body.level_value >= 0 && body.level_value <= 3 ? body.level_value : undefined
                };
            }
            return originalJson.call(this, body);
        };
        const finish = aborted => {
            if (finished) return;
            finished = true;
            if (!id && ![401, 403].includes(res.statusCode)) return;
            const job = async () => {
                const outcome = aborted ? 'aborted' : res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'denied' : 'success';
                if (!id) await start(null);
                const { resource_id, ...summary } = result;
                await repository.finalize(id, { outcome, http_status: aborted ? null : res.statusCode,
                    retention_days: policy.critical || outcome !== 'success' ? 365 : 180, resource_id: resource_id || null,
                    details: JSON.stringify({ ...safeDetails(req.body), ...(before ? { before } : {}), ...summary }) });
            };
            track((async () => {
                for (let attempt = 0; attempt < 3; attempt++) {
                    try { await job(); return; } catch {
                        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
                    }
                }
                req.log?.error({ code: 'AUDIT_FINALIZE_FAILED', event_id: id }, 'Audit result unavailable; pending record retained');
            })());
        };
        res.once('finish', () => finish(false));
        res.once('close', () => { if (!res.writableFinished) finish(true); });
        next();
    };
    return { middleware, drain: async () => { while (pending.size) await Promise.allSettled([...pending]); } };
};
module.exports = { createAuditMiddleware };
