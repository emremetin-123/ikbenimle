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
process.env.TRAINING_PROGRESS_ENFORCEMENT = 'enforce';

const setupDb = require('../database');
const { runMigrations } = require('../migrations');
const { setAuthDatabase } = require('../middleware/auth');
const createLearningRoutes = require('../modules/employee/learningRoutes');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');

test('video completion server zamanindan hizli ilerletilemez', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-progress-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const user = await db.run(
        'INSERT INTO users (employee_id, name, status, permissions) VALUES (?, ?, ?, ?)',
        ['progress-user', 'Progress User', 'active', '[]']
    );
    const video = await db.run(
        `INSERT INTO videos
            (title, requires_full_watch, requires_quiz, minimum_watch_percent, disable_forward_seek)
         VALUES (?, 1, 0, 100, 1)`,
        ['Mandatory video']
    );
    const lesson = await db.run(
        `INSERT INTO lessons (video_id, title, content_type, required_seconds, required_percent)
         VALUES (?, ?, 'video', 30, 100)`,
        [video.lastID, 'Mandatory lesson']
    );
    const assignment = await db.run(
        'INSERT INTO assignments (user_id, video_id, status) VALUES (?, ?, ?)',
        [user.lastID, video.lastID, 'assigned']
    );
    const token = 'training-progress-token';
    const csrf = 'training-progress-csrf';
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.run(
        `INSERT INTO auth_sessions
            (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [hash(token), hash(csrf), user.lastID, expiry, expiry]
    );

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api', createLearningRoutes(db));
    app.use((error, _req, res, _next) => {
        res.status(error.status || 500).json({ error: error.code || 'INTERNAL_SERVER_ERROR' });
    });
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const request = (endpoint, body) => fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`,
            'X-CSRF-Token': csrf,
            'Content-Type': 'application/json'
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const spoof = {
        video_completed: true,
        watched_seconds: 30,
        active_seconds: 30,
        last_position: 30,
        max_position: 30,
        duration_seconds: 30,
        is_playing: true
    };
    let response = await request(`/api/lesson/${lesson.lastID}/watch`, spoof);
    assert.equal(response.status, 409);
    assert.equal((await db.get('SELECT status FROM assignments WHERE id = ?', [assignment.lastID])).status, 'assigned');

    response = await request(`/api/lesson/${lesson.lastID}/watch/start`);
    assert.equal(response.status, 200);
    const progressToken = (await response.json()).progress_token;

    response = await request(`/api/lesson/${lesson.lastID}/watch`, { ...spoof, progress_token: progressToken });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'assigned');

    await db.run(
        `UPDATE training_progress_sessions
         SET last_heartbeat_at = ?, last_position = 0
         WHERE assignment_id = ? AND lesson_id = ?`,
        [new Date(Date.now() - 15_000).toISOString(), assignment.lastID, lesson.lastID]
    );
    response = await request(`/api/lesson/${lesson.lastID}/watch`, {
        ...spoof,
        progress_token: progressToken,
        last_position: 15,
        max_position: 15
    });
    assert.equal((await response.json()).status, 'assigned');

    response = await request(`/api/lesson/${lesson.lastID}/watch/start`);
    assert.equal(response.status, 200);
    const resumedProgressToken = (await response.json()).progress_token;
    assert.equal(Number((await db.get(
        `SELECT last_position FROM training_progress_sessions
         WHERE assignment_id = ? AND lesson_id = ?`,
        [assignment.lastID, lesson.lastID]
    )).last_position), 15);

    await db.run(
        `UPDATE training_progress_sessions
         SET last_heartbeat_at = ?, last_position = 15
         WHERE assignment_id = ? AND lesson_id = ?`,
        [new Date(Date.now() - 15_000).toISOString(), assignment.lastID, lesson.lastID]
    );
    response = await request(`/api/lesson/${lesson.lastID}/watch`, {
        ...spoof,
        progress_token: resumedProgressToken
    });
    assert.equal((await response.json()).status, 'completed');
    assert.equal((await db.get('SELECT status FROM assignments WHERE id = ?', [assignment.lastID])).status, 'completed');

    const legacyLesson = await db.run(
        `INSERT INTO lessons (video_id, title, content_type, required_seconds, required_percent)
         VALUES (?, ?, 'video', 0, 100)`,
        [video.lastID, 'Legacy lesson without trusted duration']
    );
    response = await request(`/api/lesson/${legacyLesson.lastID}/watch/start`);
    assert.equal(response.status, 200);
    const legacyToken = (await response.json()).progress_token;
    await db.run(
        `UPDATE training_progress_sessions SET last_heartbeat_at = ?
         WHERE assignment_id = ? AND lesson_id = ?`,
        [new Date(Date.now() - 2_000).toISOString(), assignment.lastID, legacyLesson.lastID]
    );
    response = await request(`/api/lesson/${legacyLesson.lastID}/watch`, {
        ...spoof,
        progress_token: legacyToken,
        duration_seconds: 1,
        last_position: 1,
        max_position: 1
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'assigned');
    assert.equal((await db.get(
        'SELECT status FROM lesson_progress WHERE assignment_id = ? AND lesson_id = ?',
        [assignment.lastID, legacyLesson.lastID]
    )).status, 'assigned');
});
