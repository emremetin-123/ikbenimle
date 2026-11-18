const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');

process.env.DB_TYPE = 'sqlite';
process.env.SEED_DEFAULT_USERS = 'false';
process.env.NODE_ENV = 'test';

const setupDb = require('../database');
const { runMigrations } = require('../migrations');
const reminderRoutes = require('../routes/reminders');
const { setAuthDatabase } = require('../middleware/auth');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');

test('kişisel hatırlatmalar kullanıcı sahipliğini zorunlu tutar', async t => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reminders-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const createUserSession = async suffix => {
        const user = await db.run(
            'INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)',
            [`reminder-${suffix}`, `Reminder ${suffix}`, 'employee', 'active', '[]']
        );
        const token = `reminder-token-${suffix}`;
        const csrf = `reminder-csrf-${suffix}`;
        const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await db.run(`
            INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
            VALUES (?, ?, ?, ?, ?)
        `, [hash(token), hash(csrf), user.lastID, expiry, expiry]);
        return {
            cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`,
            csrf
        };
    };

    const first = await createUserSession('first');
    const second = await createUserSession('second');
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/reminders', reminderRoutes(db));
    app.use((error, _req, res, _next) => {
        res.status(error.status || 500).json({ error: error.code || 'TEST_ERROR' });
    });
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/reminders`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (session, endpoint = '', options = {}) => fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
            Cookie: session.cookie,
            'X-CSRF-Token': session.csrf,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const createdResponse = await request(first, '', {
        method: 'POST',
        body: JSON.stringify({ text: 'Kişisel not' })
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();

    const secondList = await (await request(second)).json();
    assert.deepEqual(secondList.items, []);
    assert.equal((await request(second, `/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({ pinned: true })
    })).status, 404);
    assert.equal((await request(second, `/${created.id}`, { method: 'DELETE' })).status, 404);

    const updatedResponse = await request(first, `/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({ pinned: true, completed: true })
    });
    assert.equal(updatedResponse.status, 200);
    assert.deepEqual(
        (({ text, pinned, completed }) => ({ text, pinned, completed }))(await updatedResponse.json()),
        { text: 'Kişisel not', pinned: true, completed: true }
    );

    assert.equal((await request(first, `/${created.id}`, { method: 'DELETE' })).status, 200);
    assert.deepEqual((await (await request(first)).json()).items, []);
});
