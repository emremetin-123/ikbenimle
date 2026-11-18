const { cutoff } = require('./auditPolicy');
// Both database engines must match Turkish names even under non-Turkish collations.
const foldedActor = [['İ', 'i'], ['ı', 'i'], ['Ç', 'c'], ['ç', 'c'], ['Ğ', 'g'], ['ğ', 'g'], ['Ö', 'o'], ['ö', 'o'], ['Ş', 's'], ['ş', 's'], ['Ü', 'u'], ['ü', 'u']]
    .reduce((expression, [letter, replacement]) => `REPLACE(${expression}, '${letter}', '${replacement}')`, 'LOWER(actor_name)');
const foldSearch = value => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ı/g, 'i');
const union = `
    SELECT 'activity' AS source, id, created_at, actor_id, actor_name, actor_employee_id,
        module, action, resource_id, method, outcome, http_status, retention_days, ip_address, request_id, details
    FROM application_audit_events
    UNION ALL
    SELECT 'security' AS source, CAST(id AS TEXT), audit_created_at AS created_at, user_id AS actor_id,
        actor_name, actor_employee_id, 'session' AS module, event_type AS action,
        NULL AS resource_id, NULL AS method, CASE WHEN success = 1 THEN 'success' ELSE 'denied' END AS outcome,
        NULL AS http_status, 365 AS retention_days, ip_address, NULL AS request_id, '{}' AS details
    FROM security_audit_events
`;
const cte = `WITH events AS (${union}), entries AS (
    SELECT e.*, h.reason AS hold_reason, h.held_by_name, h.created_at AS held_at
    FROM events e LEFT JOIN audit_log_holds h ON h.source = e.source AND h.event_id = e.id
)`;
const filtersFor = (query, now) => {
    const clauses = ['(hold_reason IS NOT NULL OR (retention_days = 180 AND created_at >= ?) OR (retention_days = 365 AND created_at >= ?))'];
    const params = [cutoff(180, now), cutoff(365, now)];
    for (const key of ['source', 'module', 'action', 'outcome']) {
        if (query[key]) { clauses.push(`${key} = ?`); params.push(query[key]); }
    }
    if (query.user) {
        const pattern = '%' + foldSearch(query.user).replace(/[\\%_]/g, '\\$&') + '%';
        clauses.push(`(${foldedActor} LIKE ? ESCAPE '\\' OR actor_employee_id LIKE ? ESCAPE '\\')`);
        params.push(pattern, pattern);
    }
    if (query.start) { clauses.push('created_at >= ?'); params.push(query.start); }
    if (query.end) { clauses.push('created_at < ?'); params.push(query.end); }
    if (query.held === 'true') clauses.push('hold_reason IS NOT NULL');
    if (query.exclude_id) { clauses.push("NOT (source = 'activity' AND id = ?)"); params.push(query.exclude_id); }
    return { where: clauses.join(' AND '), params };
};
const createAuditRepository = db => ({
    insert(event) {
        const columns = ['id', 'created_at', 'actor_id', 'actor_name', 'actor_employee_id', 'module', 'action', 'resource_id', 'method', 'retention_days', 'ip_address', 'request_id', 'details'];
        return db.run(`INSERT INTO application_audit_events (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, columns.map(key => event[key] ?? null));
    },
    finalize(id, result) {
        return db.run("UPDATE application_audit_events SET outcome = ?, http_status = ?, retention_days = ?, details = ?, resource_id = COALESCE(resource_id, ?) WHERE id = ? AND outcome = 'pending'",
            [result.outcome, result.http_status, result.retention_days, result.details, result.resource_id, id]);
    },
    async list(query, pagination, now) {
        const { where, params } = filtersFor(query, now);
        // Read-only pagination must not take a write transaction/lock.
        const summary = await db.get(`${cte} SELECT COUNT(*) AS total,
            SUM(CASE WHEN outcome IN ('denied', 'error', 'aborted') THEN 1 ELSE 0 END) AS failed,
            SUM(CASE WHEN hold_reason IS NOT NULL THEN 1 ELSE 0 END) AS held FROM entries WHERE ${where}`, params);
        const items = await db.all(`${cte} SELECT source, id, created_at, actor_id, actor_name, actor_employee_id,
            module, action, resource_id, outcome, http_status, retention_days, held_at
            FROM entries WHERE ${where} ORDER BY created_at DESC, source, id DESC LIMIT ? OFFSET ?`,
            [...params, pagination.pageSize, pagination.startRow - 1]);
        return { items, summary };
    },
    get(source, id) {
        return db.get(`${cte} SELECT * FROM entries WHERE source = ? AND id = ?`, [source, id]);
    },
    hold(source, id, actor, reason, createdAt) {
        return db.run(`INSERT INTO audit_log_holds (source, event_id, reason, held_by, held_by_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(source, event_id) DO NOTHING`, [source, id, reason, actor.id, actor.name, createdAt]);
    },
    release(source, id) {
        return db.run('DELETE FROM audit_log_holds WHERE source = ? AND event_id = ?', [source, id]);
    },
    async snapshot(path, actor) {
        const assessment = path.match(/^\/api\/polyvalence\/tasks\/(\d+)\/assessments\/(\d+)$/);
        if (assessment) return db.get(`SELECT a.level_value, a.can_train FROM polyvalence_assessments a
            JOIN polyvalence_period_members m ON m.id = a.period_member_id
            JOIN polyvalence_review_tasks t ON t.period_id = a.period_id AND t.evaluator_user_id = m.evaluator_user_id
            WHERE t.id = ? AND a.id = ? AND t.evaluator_user_id = ?`, [assessment[1], assessment[2], actor.id]);
        return null;
    },
    transaction: work => db.transaction(async tx => {
        await tx.run('UPDATE audit_log_control SET last_purge_day = last_purge_day WHERE id = 1');
        return work(createAuditRepository(tx));
    }),
    async purge(now, runId, createdAt, summaryCutoff) {
        return db.transaction(async tx => {
            await tx.run('UPDATE audit_log_control SET last_purge_day = last_purge_day WHERE id = 1');
            const control = await tx.get('SELECT last_purge_day FROM audit_log_control WHERE id = 1');
            if (control.last_purge_day === createdAt.slice(0, 10)) return { skipped: true };
            const general = await tx.run(`DELETE FROM application_audit_events WHERE retention_days = 180 AND created_at < ?
                AND NOT EXISTS (SELECT 1 FROM audit_log_holds h WHERE h.source = 'activity' AND h.event_id = application_audit_events.id)`, [cutoff(180, now)]);
            const critical = await tx.run(`DELETE FROM application_audit_events WHERE retention_days = 365 AND created_at < ?
                AND NOT EXISTS (SELECT 1 FROM audit_log_holds h WHERE h.source = 'activity' AND h.event_id = application_audit_events.id)`, [cutoff(365, now)]);
            const security = await tx.run(`DELETE FROM security_audit_events WHERE audit_created_at < ?
                AND NOT EXISTS (SELECT 1 FROM audit_log_holds h WHERE h.source = 'security' AND h.event_id = CAST(security_audit_events.id AS TEXT))`, [cutoff(365, now)]);
            await tx.run('INSERT INTO audit_log_purge_runs (id, created_at, general_count, critical_count, security_count) VALUES (?, ?, ?, ?, ?)',
                [runId, createdAt, general.changes, critical.changes, security.changes]);
            await tx.run('DELETE FROM audit_log_purge_runs WHERE created_at < ?', [summaryCutoff]);
            await tx.run('UPDATE audit_log_control SET last_purge_day = ? WHERE id = 1', [createdAt.slice(0, 10)]);
            return { general: general.changes, critical: critical.changes, security: security.changes };
        });
    },
    latestPurge: () => db.get('SELECT * FROM audit_log_purge_runs ORDER BY created_at DESC, id DESC LIMIT 1'),
    unfinished: time => db.get("SELECT COUNT(*) AS total FROM application_audit_events WHERE outcome = 'pending' AND created_at < ?", [cutoff(2 / 1440, time)])
});
module.exports = { createAuditRepository };
