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
const { runMigrations } = require('../migrations');
const { setAuthDatabase } = require('../middleware/auth');
const createRoutes = require('../routes/notifications');
const { setSetting } = require('../services/appSettingsService');

test('subscription directory enforces notification permissions and exposes paginated safe device information', async t => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-subscribers-'));
    process.env.SQLITE_FILENAME = path.join(folder, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);
    const sessions = [];
    for (const [role, permissions] of [['admin', []], ['employee', ['manage_notifications']], ['employee', ['manage_users']]]) {
        const user = await db.run('INSERT INTO users (employee_id, name, role, permissions, department, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['S' + sessions.length, sessions.length ? 'Çalışan ' + sessions.length : 'ÇAĞRI İŞIK', role, JSON.stringify(permissions), 'Kalite', 'active']);
        const token = crypto.randomUUID(), csrf = crypto.randomUUID();
        const hash = value => crypto.createHash('sha256').update(value).digest('hex');
        const expiry = new Date(Date.now() + 3600000).toISOString();
        await db.run('INSERT INTO auth_sessions (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at) VALUES (?, ?, ?, ?, ?)', [hash(token), hash(csrf), user.lastID, expiry, expiry]);
        sessions.push({ id: user.lastID, cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}` });
    }
    for (let i = 0; i < 23; i++) {
        await db.run('INSERT INTO push_subscriptions (user_id, endpoint, subscription_json, device_label, is_active) VALUES (?, ?, ?, ?, ?)',
            [sessions[i < 21 ? 0 : 1].id, 'https://secret-endpoint.example/' + i, '{"keys":{"auth":"SECRET_AUTH","p256dh":"SECRET_KEY"}}', i ? 'Android · Chrome' : '<script>unsafe label</script>', i < 21 ? 1 : 0]);
    }
    const app = express(); app.use(cookieParser()); app.use(express.json()); app.use('/api/notifications', createRoutes(db));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code, message: error.message }));
    const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); fs.rmSync(folder, { recursive: true, force: true }); });
    const get = async (suffix = '', session = sessions[0], endpoint = 'subscriptions') => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/notifications/admin/${endpoint}${suffix}`, { headers: session ? { Cookie: session.cookie } : {} });
        return { response, data: await response.json() };
    };
    assert.equal((await get('', null)).response.status, 401);
    assert.equal((await get('', sessions[2])).response.status, 403);
    assert.equal((await get('', sessions[1])).response.status, 200);
    const first = await get('?status=active&pageSize=20');
    assert.equal(first.response.headers.get('cache-control'), 'no-store');
    assert.equal(first.data.pagination.total, 21);
    assert.equal(first.data.items.length, 20);
    assert.ok(first.data.items.every(row => row.is_active && row.name === 'ÇAĞRI İŞIK'));
    assert.doesNotMatch(JSON.stringify(first.data), /SECRET|secret-endpoint|subscription_json|endpoint|p256dh/);
    const second = await get('?status=active&pageSize=20&page=2');
    assert.equal(second.data.items.length, 1);
    assert.ok(!first.data.items.some(row => row.id === second.data.items[0].id));
    assert.equal((await get('?status=passive')).data.pagination.total, 2);
    assert.equal((await get('?search=CAGRI%20ISIK')).data.pagination.total, 21);
    assert.equal((await get('?search=%25')).data.pagination.total, 0);
    assert.equal((await get('?search=%27%20OR%201%3D1--')).data.pagination.total, 0);
    for (const suffix of ['?page=0', '?pageSize=101', '?status=wrong', '?endpoint=leak']) assert.equal((await get(suffix)).response.status, 400);
    const stats = (await get('', sessions[0], 'stats')).data;
    assert.equal(stats.total, 23); assert.equal(stats.active, 21);
    await setSetting(db, 'notification_template_quote_daily_last_sent_date', '2026-10-28');
    await setSetting(db, 'notification_template_quote_daily_last_attempt', JSON.stringify({ status: 'failed', attempted_at: '2026-10-29T14:34:00.000Z', sent: 0, failed: 2, retry_at: '2026-10-29T14:49:00.000Z', secret: 'SECRET_AUTH' }));
    const templates = (await get('', sessions[0], 'event-templates')).data;
    const quote = templates.items.find(item => item.key === 'quote_daily');
    assert.equal(quote.delivery.last_processed_date, '2026-10-28');
    assert.equal(quote.delivery.last_attempt.failed, 2);
    assert.doesNotMatch(JSON.stringify(templates), /SECRET_AUTH/);
});
