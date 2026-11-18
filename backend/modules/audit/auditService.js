const crypto = require('node:crypto');
const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');
const { MODULES, ACTIONS, stamp } = require('./auditPolicy');
const { createAuditRepository } = require('./auditRepository');
const decorate = row => ({ ...row, module_label: MODULES[row.module] || row.module, action_label: ACTIONS[row.action] || 'Oturum işlemi',
    description: (MODULES[row.module] || row.module) + ' · ' + (ACTIONS[row.action] || 'Oturum işlemi') + (row.resource_id ? ' · Kayıt ' + row.resource_id : ''),
    details: row.details ? JSON.parse(row.details) : undefined });
const toQuery = query => ({ ...query,
    start: query.from ? stamp(query.from + 'T00:00:00+03:00') : null,
    end: query.to ? stamp(new Date(Number(new Date(query.to + 'T00:00:00+03:00')) + 86_400_000)) : null
});
const csvCell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
};
const createAuditService = (db, { now = () => Date.now() } = {}) => {
    const repository = createAuditRepository(db);
    return {
        async list(query, excludeId = null) {
            const pagination = parsePagination(query);
            const { items, summary } = await repository.list({ ...toQuery(query), exclude_id: excludeId }, pagination, now());
            return { ...paginatedResponse(items.map(decorate), summary.total, pagination.page, pagination.pageSize),
                summary: { total: Number(summary.total), failed: Number(summary.failed || 0), held: Number(summary.held || 0) } };
        },
        async detail(source, id) {
            const row = await repository.get(source, id);
            if (!row) throw new AppError(404, 'AUDIT_NOT_FOUND', 'Log kaydı bulunamadı.');
            return decorate(row);
        },
        async hold(source, id, actor, reason) {
            // The existence check and hold are atomic with respect to the database cleanup transaction.
            return repository.transaction(async tx => {
                const row = await tx.get(source, id);
                if (!row) throw new AppError(404, 'AUDIT_NOT_FOUND', 'Log kaydı bulunamadı.');
                const changed = await tx.hold(source, id, actor, reason, stamp(now()));
                return { success: true, already_held: changed.changes === 0 };
            });
        },
        async release(source, id) {
            return repository.transaction(async tx => {
                if (!await tx.get(source, id)) throw new AppError(404, 'AUDIT_NOT_FOUND', 'Log kaydı bulunamadı.');
                const changed = await tx.release(source, id);
                return { success: true, already_released: changed.changes === 0 };
            });
        },
        async export(query, excludeId = null) {
            const { items, summary } = await repository.list({ ...toQuery(query), exclude_id: excludeId }, { pageSize: 5000, startRow: 1 }, now());
            if (Number(summary.total) > 5000) throw new AppError(422, 'AUDIT_EXPORT_LIMIT', 'Tek dosyada en fazla 5.000 kayıt aktarılabilir. Filtreleri daraltın.');
            const header = ['Tarih (UTC)', 'Kullanıcı', 'Sicil', 'Modül', 'İşlem', 'Sonuç', 'Kayıt', 'Koruma'];
            const outcomes = { success: 'Başarılı', denied: 'Reddedildi', error: 'Hata', pending: 'Sonuç bekleniyor', aborted: 'Bağlantı kesildi' };
            return '\uFEFF' + [header, ...items.map(row => [row.created_at, row.actor_name || (row.actor_id ? 'Kullanıcı #' + row.actor_id : 'Kimliği doğrulanmadı'), row.actor_employee_id,
                MODULES[row.module], ACTIONS[row.action] || row.action, outcomes[row.outcome], row.resource_id, row.held_at ? 'Korunuyor' : ''])].map(row => row.map(csvCell).join(';')).join('\r\n');
        },
        async policy() {
            const latest = await repository.latestPurge();
            const overdue = !latest || Number(new Date(stamp(now()).replace(' ', 'T') + 'Z')) - Number(new Date(latest.created_at.replace(' ', 'T') + 'Z')) > 36 * 3_600_000;
            return { general_days: 180, critical_days: 365, purge_summary_years: 3, last_purge: latest, cleanup_overdue: overdue,
                unfinished_count: Number((await repository.unfinished(now())).total),
                modules: Object.entries(MODULES).map(([value, label]) => ({ value, label })), actions: Object.entries(ACTIONS).map(([value, label]) => ({ value, label })) };
        },
        async purge() {
            const time = now();
            const threeYearsAgo = new Date(time);
            threeYearsAgo.setUTCFullYear(threeYearsAgo.getUTCFullYear() - 3);
            return repository.purge(time, crypto.randomUUID(), stamp(time), stamp(threeYearsAgo));
        }
    };
};
module.exports = { createAuditService };
