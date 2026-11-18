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
const { setAuthDatabase } = require('../middleware/auth');
const {
    createAdminFeedbackRouter,
    createEmployeeFeedbackRouter
} = require('../routes/feedback');

const tokenHash = value => crypto.createHash('sha256').update(value).digest('hex');

test('feedback admin ve calisan yorumlarini ayri yetki ve gorunurlukle isler', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-routes-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const employee = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)',
        ['feedback-owner', 'Feedback Owner', 'employee', 'active', '[]']
    );
    const admin = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)',
        ['feedback-admin', 'Feedback Admin', 'employee', 'active', JSON.stringify(['manage_feedback'])]
    );
    const feedback = await db.run(
        'INSERT INTO feedback (user_id, type, title, content) VALUES (?, ?, ?, ?)',
        [employee.lastID, 'suggestion', 'Test', 'Test content']
    );
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    for (const [token, userId] of [['employee-token', employee.lastID], ['admin-token', admin.lastID]]) {
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [tokenHash(token), tokenHash(`${token}-csrf`), userId, expiry, expiry]
        );
    }

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/feedback', createEmployeeFeedbackRouter(db));
    app.use('/api/admin/feedback', createAdminFeedbackRouter(db));
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const request = (url, token, options = {}) => fetch(`${baseUrl}${url}`, {
        ...options,
        headers: {
            Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${token}-csrf`,
            'X-CSRF-Token': `${token}-csrf`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    let response = await request(`/api/admin/feedback/${feedback.lastID}/comments`, 'admin-token', {
        method: 'POST',
        body: JSON.stringify({ comment: 'Internal note', is_public: false })
    });
    assert.equal(response.status, 200);

    response = await request(`/api/feedback/${feedback.lastID}/comments`, 'employee-token', {
        method: 'POST',
        body: JSON.stringify({ comment: 'Employee reply', is_public: false })
    });
    assert.equal(response.status, 200);

    const comments = await db.all(
        'SELECT comment, is_public FROM feedback_comments WHERE feedback_id = ? ORDER BY id',
        [feedback.lastID]
    );
    assert.deepEqual(comments.map(row => [row.comment, Number(row.is_public)]), [
        ['Internal note', 0],
        ['Employee reply', 1]
    ]);

    const employeeThread = await request(`/api/feedback/${feedback.lastID}/thread`, 'employee-token');
    assert.equal(employeeThread.status, 200);
    assert.deepEqual((await employeeThread.json()).comments.map(item => item.comment), ['Employee reply']);

    const adminThread = await request(`/api/admin/feedback/${feedback.lastID}/thread`, 'admin-token');
    assert.equal(adminThread.status, 200);
    assert.deepEqual((await adminThread.json()).comments.map(item => item.comment), ['Internal note', 'Employee reply']);

    assert.equal(
        (await request('/api/feedback/user-options?page=1&pageSize=25', 'admin-token')).status,
        404
    );
});
