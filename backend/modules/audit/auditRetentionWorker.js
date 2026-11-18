const { createAuditService } = require('./auditService');
const startAuditRetentionWorker = db => {
    const service = createAuditService(db);
    let running = null;
    let stopped = false;
    const tick = () => {
        if (stopped || running) return;
        running = service.purge().catch(() => console.error('AUDIT_RETENTION_FAILED: audit cleanup will retry.'))
            .finally(() => { running = null; });
    };
    tick();
    const timer = setInterval(tick, 60 * 60 * 1000);
    timer.unref?.();
    return async () => { stopped = true; clearInterval(timer); if (running) await running; };
};
module.exports = { startAuditRetentionWorker };
