const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
process.env.DB_TYPE = 'sqlite';
process.env.NODE_ENV = 'test';
process.env.SEED_DEFAULT_USERS = 'false';
const setupDb = require('../database');
const { runMigrations, MIGRATIONS } = require('../migrations');
const { authenticateToken, requirePermission, setAuthDatabase } = require('../middleware/auth');
const { audit } = require('../services/sessionService');
const { createAuditMiddleware } = require('../modules/audit/auditMiddleware');
const { createAuditRepository } = require('../modules/audit/auditRepository');
const { createAuditService } = require('../modules/audit/auditService');
const { auditQuery } = require('../modules/audit/auditSchemas');
const { classify, stamp, cutoff } = require('../modules/audit/auditPolicy');
const createAuditRoutes = require('../modules/audit/auditRoutes');

test('işlem günlüğü yetkileri, gizlilik, hata ve saklama sınırlarını korur', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-logs-'));
    process.env.SQLITE_FILENAME = path.join(directory, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);
    const sessions = [];
    for (const [employee, name, role, permissions] of [['audit-admin', 'Sistem Yöneticisi', 'admin', []], ['audit-manager', 'Bölüm Yöneticisi', 'employee', ['manage_users']], ['audit-employee', 'Çalışan', 'employee', []]]) {
        const result = await db.run('INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)', [employee, name, role, 'active', JSON.stringify(permissions)]);
        const token = crypto.randomUUID(), csrf = crypto.randomUUID();
        const hash = value => crypto.createHash('sha256').update(value).digest('hex');
        const expiry = new Date(Date.now() + 3_600_000).toISOString();
        await db.run('INSERT INTO auth_sessions (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at) VALUES (?, ?, ?, ?, ?)', [hash(token), hash(csrf), result.lastID, expiry, expiry]);
        sessions.push({ id: result.lastID, name, employee, headers: { Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`, 'X-CSRF-Token': csrf } });
    }
    const [admin, manager, employee] = sessions;
    let unavailable = false, finalizationFailure = false, businessWrites = 0;
    const proxy = new Proxy(db, { get(target, key) {
        if (key === 'run') return (sql, params) => {
            if (unavailable && sql.startsWith('INSERT INTO application_audit_events')) throw new Error('storage unavailable');
            if (finalizationFailure && sql.startsWith('UPDATE application_audit_events SET outcome')) throw new Error('write interrupted');
            return target.run(sql, params);
        };
        const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    const journal = createAuditMiddleware(proxy);
    const app = express();
    app.use(cookieParser()); app.use(express.json()); app.use(journal.middleware);
    app.use('/api/admin', createAuditRoutes(db));
    app.put('/api/admin/users/:id', authenticateToken, requirePermission('manage_users'), (req, res) => { businessWrites++; res.json({ success: true, id: Number(req.params.id) }); });
    app.get('/api/announcements', authenticateToken, (_req, res) => res.json([]));
    app.post('/api/mood-check', authenticateToken, (_req, res) => res.json({ success: true }));
    app.post('/api/feedback', authenticateToken, (_req, res) => res.json({ success: true }));
    app.get('/api/admin/documents/report.csv', authenticateToken, (_req, res) => res.send('test'));
    app.use((_req, res) => res.sendStatus(404));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code || 'INTERNAL_SERVER_ERROR', message: error.message }));
    const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (endpoint, { session = admin, method = 'GET', body, headers = {} } = {}) => {
        const response = await fetch(base + endpoint, { method, headers: { ...session?.headers, ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const text = await response.text(); await journal.drain();
        return { response, text, json: () => JSON.parse(text) };
    };
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await journal.drain(); await db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    const repository = createAuditRepository(db);

    await t.test('yalnız admin okuyabilir; CSRF ve güvenilir aktör kimliği korunur', async () => {
        assert.equal((await request('/api/admin/audit-logs', { session: employee })).response.status, 403);
        assert.equal((await request('/api/admin/audit-logs', { session: manager })).response.status, 403);
        assert.equal((await request('/api/admin/audit-logs', { session: null })).response.status, 401);
        assert.equal((await request('/api/admin/audit-logs')).response.status, 200);
        const denied = await request('/api/admin/users/55', { method: 'PUT', body: { actor_id: admin.id, password: 'NEVER_LOG_THIS_PASSWORD' }, session: employee });
        assert.equal(denied.response.status, 403);
        const deniedRow = await db.get("SELECT * FROM application_audit_events WHERE module = 'users' ORDER BY created_at DESC LIMIT 1");
        assert.equal(deniedRow.actor_id, employee.id); assert.equal(deniedRow.outcome, 'denied');
        const csrf = await request('/api/admin/users/55', { method: 'PUT', body: { name: 'Name' }, headers: { 'X-CSRF-Token': 'wrong' } });
        assert.equal(csrf.response.status, 403); assert.equal(businessWrites, 0);
        assert.equal((await request('/api/admin/users/55', { method: 'PUT', body: { name: 'Changed', password: 'NEVER_LOG_THIS_PASSWORD', token: 'NEVER_LOG_THIS_TOKEN', address: 'NEVER_LOG_THIS_ADDRESS' } })).response.status, 200);
        assert.equal(businessWrites, 1);
        const records = await db.all('SELECT * FROM application_audit_events');
        assert.doesNotMatch(JSON.stringify(records), /NEVER_LOG_THIS/);
        assert.ok(records.some(row => row.actor_id === admin.id && row.outcome === 'success' && row.retention_days === 365));
    });
    await t.test('anonim kaynaklar ve heartbeat kayda girmez; okuma/indirme sınıflanır', async () => {
        const before = (await db.get('SELECT COUNT(*) AS n FROM application_audit_events')).n;
        await request('/api/mood-check', { method: 'POST', body: { mood: 'happy' }, session: employee });
        await request('/api/feedback', { method: 'POST', body: { is_anonymous: true, message: 'NEVER_LOG_ANONYMOUS_TEXT' }, session: employee });
        assert.equal((await db.get('SELECT COUNT(*) AS n FROM application_audit_events')).n, before);
        assert.equal(classify({ method: 'POST', originalUrl: '/api/lesson/3/watch/heartbeat' }), null);
        assert.equal(classify({ method: 'PUT', originalUrl: '/api/admin/feedback/3/status' }).action, 'update');
        assert.equal(classify({ method: 'POST', originalUrl: '/api/lesson/3/quiz' }).action, 'quiz');
        assert.equal(classify({ method: 'PUT', originalUrl: '/api/admin/feedback/3/decision', body: { decision: 'rejected' } }).action, 'reject');
        await request('/api/announcements', { session: employee });
        assert.equal((await db.get("SELECT retention_days FROM application_audit_events WHERE module = 'announcements'")).retention_days, 180);
        assert.equal(classify({ method: 'GET', originalUrl: '/api/assignment/20/certificate.pdf' }).action, 'download');
        assert.equal(classify({ method: 'GET', originalUrl: '/api/polyvalence/periods/10/report' }).action, 'view');
        assert.equal(classify({ method: 'GET', originalUrl: '/api/polyvalence/my-tasks/summary' }), null);
        for (const originalUrl of ['/api/admin/announcements/departments', '/api/directory/birthdays/today?page=1',
            '/api/leave-requests/balance', '/api/meal-menu/today', '/api/meal-menu/2026-11-07/rating']) {
            assert.equal(classify({ method: 'GET', originalUrl }), null);
        }
        assert.equal(classify({ method: 'GET', originalUrl: '/api/admin/announcements?page=1' }).action, 'view');
        for (const [endpoint, module] of [['news', 'news'], ['announcements', 'announcements']]) {
            assert.equal(classify({ method: 'GET', originalUrl: `/api/${endpoint}/home-preview` }).module, 'home');
            assert.equal(classify({ method: 'GET', originalUrl: `/api/${endpoint}?page=1` }).module, module);
            assert.equal(classify({ method: 'GET', originalUrl: `/api/admin/${endpoint}/home-preview` }).module, module);
        }
        assert.equal(classify({ method: 'GET', originalUrl: '/api/user/profile' }).action, 'view');
        assert.equal(classify({ method: 'POST', originalUrl: '/api/meal-menu/2026-11-07/rating' }).action, 'create');
        assert.equal(classify({ method: 'POST', originalUrl: '/api/admin/meal-menu/parse-pdf' }).action, 'analyze');
        const reading = await request('/api/admin/audit-logs?module=announcements&action=view');
        assert.equal(reading.json().items[0].action_label, 'Veri okuma');
        assert.doesNotMatch(reading.json().items[0].description, /Görüntüleme|Giriş/);
        assert.equal(classify({ method: 'GET', originalUrl: '/uploads/documents/file.pdf?secret=123' }).resource_id.startsWith('dosya:'), true);
    });
    await t.test('oturum geçmişi güvenli alanlarla ve kullanıcı anlık görüntüsüyle görünür', async () => {
        await audit(db, { ip: '127.0.0.1', get: () => 'Test browser' }, 'login_success', true, admin.id, { password: 'NEVER_LOG_SECURITY_METADATA' });
        await db.run('UPDATE users SET name = ? WHERE id = ?', ['Renamed Admin', admin.id]);
        const result = await request('/api/admin/audit-logs?module=session');
        const row = result.json().items[0]; assert.equal(row.actor_name, admin.name);
        const detail = await request('/api/admin/audit-logs/security/' + row.id);
        assert.doesNotMatch(detail.text, /NEVER_LOG_SECURITY_METADATA|user_agent|token_hash/);
        assert.equal(detail.response.headers.get('cache-control'), 'no-store');
    });
    await t.test('filtreler, tarih doğrulaması, sayfalama ve güvenli CSV çalışır', async () => {
        const invalid = ['/api/admin/audit-logs?sort=actor_id', '/api/admin/audit-logs?from=2026-02-30', '/api/admin/audit-logs?from=2026-10-30&to=2026-10-01', '/api/admin/audit-logs?page=0'];
        for (const endpoint of invalid) assert.equal((await request(endpoint)).response.status, 400);
        const filtered = (await request('/api/admin/audit-logs?module=users&outcome=success&pageSize=1')).json();
        assert.equal(filtered.items.length, 1); assert.equal(filtered.items[0].module, 'users'); assert.equal(filtered.items[0].outcome, 'success');
        assert.equal((await request('/api/admin/audit-logs?user=%27%20OR%201%3D1--')).json().pagination.total, 0);
        const id = crypto.randomUUID();
        await repository.insert({ id, created_at: stamp(Date.now()), actor_id: admin.id, actor_name: '=HYPERLINK("danger")', module: 'documents', action: 'view', method: 'GET', retention_days: 180, details: '{}' });
        await repository.finalize(id, { outcome: 'success', http_status: 200, retention_days: 180, details: '{}', resource_id: null });
        const exported = await request('/api/admin/audit-logs/export?module=documents');
        assert.equal(exported.response.status, 200); assert.match(exported.text, /'\=HYPERLINK/); assert.match(exported.response.headers.get('content-type'), /text\/csv/);
        const row = await db.get("SELECT action, retention_days FROM application_audit_events WHERE module = 'audit' AND action = 'export' ORDER BY created_at DESC LIMIT 1");
        assert.equal(row.retention_days, 365);
        assert.equal(auditQuery.safeParse({ from: '2026-10-01', to: '2026-10-01' }).success, true);
    });
    await t.test('log deposu yoksa işlem başlamaz; sonuç hatası başarı diye gösterilmez', async () => {
        unavailable = true;
        const before = businessWrites;
        assert.equal((await request('/api/admin/users/55', { method: 'PUT', body: { name: 'Not saved' } })).response.status, 503);
        assert.equal(businessWrites, before); unavailable = false;
        finalizationFailure = true;
        assert.equal((await request('/api/admin/users/777', { method: 'PUT', body: { name: 'Saved business action' } })).response.status, 200);
        finalizationFailure = false;
        assert.equal((await db.get("SELECT outcome FROM application_audit_events WHERE resource_id = '777'")).outcome, 'pending');
        assert.equal((await db.get("SELECT retention_days FROM application_audit_events WHERE resource_id = '777'")).retention_days, 365);
    });
    await t.test('Türkiye günü, mevcut isteği dışlama ve export üst sınırı uygulanır', async () => {
        const service = createAuditService(db, { now: () => +new Date('2026-10-29T12:00:00Z') });
        const ids = [];
        for (const created_at of ['2026-10-27 20:59:59.999', '2026-10-27 21:00:00.000', '2026-10-28 20:59:59.999', '2026-10-28 21:00:00.000']) {
            const id = crypto.randomUUID(); ids.push(id);
            await repository.insert({ id, created_at, module: 'meals', action: 'view', method: 'GET', retention_days: 180, details: '{}' });
            await repository.finalize(id, { outcome: 'success', http_status: 200, retention_days: 180, details: '{}', resource_id: null });
        }
        const day = await service.list({ module: 'meals', from: '2026-10-28', to: '2026-10-28' });
        assert.deepEqual(day.items.map(row => row.id).sort(), ids.slice(1, 3).sort());
        assert.equal((await service.list({ module: 'meals' }, ids[0])).pagination.total, 3);
        await db.run('UPDATE application_audit_events SET actor_name = ? WHERE id = ?', ['ÇAĞRI İŞIK', ids[1]]);
        assert.equal((await service.list({ module: 'meals', user: 'çağrı ışık' })).pagination.total, 1);
        assert.equal((await service.list({ module: 'meals', user: 'CAGRI ISIK' })).pagination.total, 1);
        await db.run(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 5001)
            INSERT INTO application_audit_events (id, created_at, module, action, method, outcome, retention_days)
            SELECT 'export-' || CAST(n AS TEXT), ?, 'news', 'view', 'GET', 'success', 180 FROM seq`, [stamp(Date.now())]);
        await assert.rejects(() => createAuditService(db).export({ module: 'news' }), error => error.code === 'AUDIT_EXPORT_LIMIT');
        await db.run("DELETE FROM application_audit_events WHERE id LIKE 'export-%'");
    });
    await t.test('180/365 gün sınırları, koruma, günlük tek temizlik ve üç yıllık imha özeti korunur', async () => {
        const time = new Date('2026-10-28T12:00:00Z').getTime();
        const service = createAuditService(db, { now: () => time });
        const add = async (id, days, createdAt) => {
            await repository.insert({ id, created_at: createdAt, actor_id: admin.id, module: 'training', action: 'view', method: 'GET', retention_days: days, details: '{}' });
            await repository.finalize(id, { outcome: 'success', http_status: 200, retention_days: days, details: '{}', resource_id: null });
        };
        const old = crypto.randomUUID(), boundary = crypto.randomUUID(), critical = crypto.randomUUID(), held = crypto.randomUUID();
        await add(old, 180, stamp(time - 180 * 86_400_000 - 1)); await add(boundary, 180, cutoff(180, time));
        await add(critical, 365, stamp(time - 366 * 86_400_000)); await add(held, 180, stamp(time - 200 * 86_400_000));
        const adminUser = { id: admin.id, name: admin.name };
        await service.hold('activity', held, adminUser, 'İnceleme devam ettiği için korunuyor.');
        assert.equal((await service.hold('activity', held, adminUser, 'İkinci gerekçe eskisini ezemez.')).already_held, true);
        const holdsResponse = await request('/api/admin/audit-logs?held=true'); assert.ok(holdsResponse.json().items.some(row => row.id === held));
        const rejectedHold = await request('/api/admin/audit-logs/activity/' + held + '/hold', { method: 'POST', session: manager, body: { reason: 'Yetkisiz koruma girişimi' } });
        assert.equal(rejectedHold.response.status, 403);
        const userCount = (await db.get('SELECT COUNT(*) AS n FROM users')).n;
        await db.run("INSERT INTO audit_log_purge_runs (id, created_at, general_count, critical_count, security_count) VALUES ('old-summary', '2022-01-01 00:00:00', 2, 0, 0)");
        const oldSecurity = await db.run("INSERT INTO security_audit_events (event_type, success, audit_created_at) VALUES ('login_failed', 0, ?)", [cutoff(366, time)]);
        const heldSecurity = await db.run("INSERT INTO security_audit_events (event_type, success, audit_created_at) VALUES ('login_success', 1, ?)", [cutoff(366, time)]);
        await service.hold('security', String(heldSecurity.lastID), adminUser, 'Güvenlik incelemesi devam ediyor.');
        await service.purge();
        assert.equal(await repository.get('activity', old), undefined); assert.equal(await repository.get('activity', critical), undefined);
        assert.ok(await repository.get('activity', boundary)); assert.ok(await repository.get('activity', held));
        assert.equal(await repository.get('security', String(oldSecurity.lastID)), undefined);
        assert.ok(await repository.get('security', String(heldSecurity.lastID)));
        assert.equal((await service.purge()).skipped, true);
        assert.equal((await db.get('SELECT COUNT(*) AS n FROM users')).n, userCount);
        assert.equal(await db.get("SELECT * FROM audit_log_purge_runs WHERE id = 'old-summary'"), undefined);
        const purge = await db.get('SELECT * FROM audit_log_purge_runs ORDER BY created_at DESC LIMIT 1');
        assert.ok(purge.general_count >= 1); assert.ok(purge.security_count >= 1);
        const release = await request('/api/admin/audit-logs/activity/' + held + '/release', { method: 'POST', body: {} });
        assert.equal(release.response.status, 200);
        await service.release('security', String(heldSecurity.lastID));
        await createAuditService(db, { now: () => time + 86_400_000 }).purge();
        assert.equal(await repository.get('activity', held), undefined);
        assert.equal(await repository.get('security', String(heldSecurity.lastID)), undefined);
        assert.equal((await service.policy()).cleanup_overdue, false);
        const fresh = crypto.randomUUID();
        await add(fresh, 180, stamp(time));
        assert.equal((await request('/api/admin/audit-logs/activity/' + fresh, { method: 'DELETE', body: {} })).response.status, 404);
        assert.ok(await repository.get('activity', fresh));
        const other = await setupDb();
        try {
            const next = () => time + 2 * 86_400_000;
            const runs = await Promise.all([createAuditService(db, { now: next }).purge(), createAuditService(other, { now: next }).purge()]);
            assert.equal(runs.filter(row => row.skipped).length, 1);
        } finally { await other.close(); }
    });
    await t.test('migration geri alınıp uygulanır; asıl kullanıcı kayıtları korunur', async () => {
        await journal.drain();
        const migration = MIGRATIONS.find(item => item.version === '024_application_audit_logs');
        await migration.down(db); assert.equal((await db.get('SELECT COUNT(*) AS n FROM users')).n, 3);
        await migration.up(db, 'sqlite');
        assert.equal((await db.get('SELECT COUNT(*) AS n FROM application_audit_events')).n, 0);
    });
});
