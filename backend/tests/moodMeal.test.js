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
const { MIGRATIONS, runMigrations } = require('../migrations');
const { setAuthDatabase } = require('../middleware/auth');
const { AppError } = require('../core/http');
const createMoodRouter = require('../routes/mood');
const createMealMenuRouter = require('../routes/mealMenus');

const listen = app => new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const createSession = async (db, userId, token, csrfToken) => {
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.run(
        `INSERT INTO auth_sessions
            (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
            crypto.createHash('sha256').update(token).digest('hex'),
            crypto.createHash('sha256').update(csrfToken).digest('hex'),
            userId,
            expiry,
            expiry
        ]
    );
};

test('duygu ve yemek raporlari sayfali, dogrulanmis ve yetkilidir', async t => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mood-meal-contract-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await MIGRATIONS.find(migration => migration.version === '000_initial_schema')
        .up(db, 'sqlite');
    const legacyEmployee = await db.run(
        `INSERT INTO users
            (employee_id, name, department, position, role, status, permissions)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['legacy-mood-user', 'Legacy Çalışan', 'Taşlama', 'Operatör', 'employee', 'active', '[]']
    );
    await db.run(
        `INSERT INTO mood_checks
            (user_id, mood_date, mood_id, mood_label, mood_score, department, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [legacyEmployee.lastID, '2025-01-01', 'good', 'İyi', 4, 'Taşlama', 'Operatör']
    );
    await runMigrations(db);
    const legacyTableAfterMigration = await db.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mood_checks'"
    );
    assert.equal(legacyTableAfterMigration, undefined);
    const migratedLegacyMood = await db.get(
        `SELECT mood_date, mood_id, department
         FROM anonymous_mood_checks
         WHERE mood_date = ?`,
        ['2025-01-01']
    );
    assert.deepEqual(migratedLegacyMood, {
        mood_date: '2025-01-01',
        mood_id: 'good',
        department: 'Taşlama'
    });
    setAuthDatabase(db);

    const admin = await db.run(
        `INSERT INTO users
            (employee_id, name, department, position, role, status, permissions)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['mood-meal-admin', 'Rapor Admin', 'YBS', 'Uzman', 'admin', 'active', '[]']
    );
    const employeeIds = [];
    for (const [employeeId, name, department] of [
        ['mood-meal-1', 'Ayse Test', 'Pres'],
        ['mood-meal-2', 'Berk Test', 'Pres'],
        ['mood-meal-3', 'Cem Test', 'YBS']
    ]) {
        const result = await db.run(
            `INSERT INTO users
                (employee_id, name, department, position, role, status, permissions)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [employeeId, name, department, 'Operator', 'employee', 'active', '[]']
        );
        employeeIds.push(result.lastID);
    }

    await createSession(db, admin.lastID, 'mood-meal-admin-token', 'mood-meal-admin-csrf');
    await createSession(db, employeeIds[0], 'mood-meal-employee-token', 'mood-meal-employee-csrf');

    for (let index = 0; index < employeeIds.length; index += 1) {
        await db.run(
            `INSERT INTO anonymous_mood_checks
                (mood_date, mood_id, mood_label, mood_score, department)
             VALUES (?, ?, ?, ?, ?)`,
            [
                '2026-07-24',
                index === 0 ? 'sad' : 'good',
                index === 0 ? 'Üzgün' : 'İyi',
                index === 0 ? 1 : 4,
                'Pres'
            ]
        );
    }
    await db.run(
        `INSERT INTO mood_callback_requests
            (user_id, requested_date, status)
         VALUES (?, ?, ?)`,
        [employeeIds[0], '2026-07-24', 'pending']
    );

    for (const date of ['2026-07-01', '2026-07-02', '2026-07-03']) {
        await db.run(
            'INSERT INTO meal_menus (meal_date, items, created_by) VALUES (?, ?, ?)',
            [date, JSON.stringify(['Çorba', 'Ana yemek']), admin.lastID]
        );
    }
    for (let index = 0; index < employeeIds.length; index += 1) {
        await db.run(
            `INSERT INTO meal_menu_ratings
                (meal_date, user_id, food_score, staff_score, cleanliness_score,
                 comment, department, position)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                '2026-07-01',
                employeeIds[index],
                index + 3,
                4,
                5,
                `Yorum ${index + 1}`,
                index === 2 ? 'YBS' : 'Pres',
                'Operator'
            ]
        );
    }

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/mood-check', createMoodRouter(db));
    app.use('/api/meal-menu', createMealMenuRouter(db));
    app.use('/api/admin/meal-menu', createMealMenuRouter(db, 'admin'));
    app.use((err, req, res, _next) => {
        if (err instanceof AppError) {
            return res.status(err.status).json({
                error: err.code,
                message: err.message,
                details: err.details,
                request_id: req.id
            });
        }
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    });
    const server = await listen(app);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (url, token = 'mood-meal-admin-token', options = {}) => fetch(
        `${baseUrl}${url}`,
        {
            ...options,
            headers: {
                Cookie: `ikbenimle_session=${token}`,
                ...(options.headers || {})
            }
        }
    );
    const getJson = async (url, token) => {
        const response = await request(url, token);
        assert.equal(response.status, 200);
        return response.json();
    };

    const mood = await getJson(
        '/api/mood-check/admin?from=2026-07-01&to=2026-07-31&page=1&pageSize=2'
    );
    assert.deepEqual(mood.pagination, {
        page: 1,
        pageSize: 2,
        total: 2,
        totalPages: 1
    });
    assert.equal(mood.items.length, 2);
    assert.equal(mood.summary.total, 3);
    assert.equal(mood.summary.callbacks, 1);
    assert.equal(mood.items.every(item => !Object.hasOwn(item, 'user_id')), true);
    assert.equal(mood.items.every(item => !Object.hasOwn(item, 'callback_name')), true);
    assert.equal(
        (await request(
            '/api/mood-check/admin?from=2026-07-01&to=2026-07-31',
            'mood-meal-employee-token'
        )).status,
        403
    );

    const validMood = await request('/api/mood-check', 'mood-meal-employee-token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': 'mood-meal-employee-csrf'
        },
        body: JSON.stringify({
            mood_id: 'tired',
            reason_key: 'workload'
        })
    });
    assert.equal(validMood.status, 200);
    const savedMood = await db.get(
        `SELECT mood_id, mood_label, reason_key
         FROM anonymous_mood_checks
         WHERE mood_id = ? AND reason_key = ?
         ORDER BY id DESC`,
        ['tired', 'workload']
    );
    assert.ok(savedMood);
    assert.equal(savedMood.mood_id, 'tired');
    assert.equal(savedMood.reason_key, 'workload');
    const anonymousColumns = await db.all('PRAGMA table_info(anonymous_mood_checks)');
    assert.equal(anonymousColumns.some(column => column.name === 'user_id'), false);
    const receiptTable = await db.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mood_submission_receipts'"
    );
    assert.equal(receiptTable, undefined);
    const moodCookie = validMood.headers.get('set-cookie')
        ?.split(';')[0];
    assert.ok(moodCookie);

    const duplicateMood = await request('/api/mood-check', 'mood-meal-employee-token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': 'mood-meal-employee-csrf',
            Cookie: `ikbenimle_session=mood-meal-employee-token; ${moodCookie}`
        },
        body: JSON.stringify({ mood_id: 'good' })
    });
    assert.equal(duplicateMood.status, 409);

    const callbackRequest = await request(
        '/api/mood-check/callback-request',
        'mood-meal-employee-token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': 'mood-meal-employee-csrf',
                Cookie: `ikbenimle_session=mood-meal-employee-token; ${moodCookie}`
            },
            body: JSON.stringify({})
        }
    );
    assert.equal(callbackRequest.status, 200);
    const callback = await db.get(
        `SELECT user_id, requested_date
         FROM mood_callback_requests
         WHERE user_id = ?
         ORDER BY id DESC`,
        [employeeIds[0]]
    );
    assert.ok(callback);
    const callbackColumns = await db.all('PRAGMA table_info(mood_callback_requests)');
    assert.equal(callbackColumns.some(column => column.name === 'mood_check_id'), false);

    const invalidMood = await request('/api/mood-check', 'mood-meal-employee-token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': 'mood-meal-employee-csrf'
        },
        body: JSON.stringify({ mood_id: 'good', unexpected: true })
    });
    assert.equal(invalidMood.status, 400);
    assert.equal((await invalidMood.json()).error, 'VALIDATION_ERROR');

    const menus = await getJson('/api/admin/meal-menu?month=2026-07&page=1&pageSize=2');
    assert.deepEqual(menus.pagination, {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
    assert.equal(menus.items.length, 2);

    const summary = await getJson('/api/admin/meal-menu/ratings/summary?month=2026-07');
    assert.equal(summary.overall.response_count, 3);
    assert.equal(summary.summary.length, 1);
    assert.equal(Object.hasOwn(summary, 'rows'), false);

    const ratings = await getJson(
        '/api/admin/meal-menu/ratings?month=2026-07&date=2026-07-01&page=1&pageSize=2'
    );
    assert.deepEqual(ratings.pagination, {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
    assert.equal(ratings.items.length, 2);
    assert.equal(
        (await request(
            '/api/admin/meal-menu/ratings/summary?month=2026-07',
            'mood-meal-employee-token'
        )).status,
        403
    );

    const invalidDate = await request(
        '/api/admin/meal-menu/ratings?month=2026-07&date=2026-08-01'
    );
    assert.equal(invalidDate.status, 400);
    assert.equal((await invalidDate.json()).error, 'DATE_OUTSIDE_MONTH');

    const invalidRating = await request(
        '/api/meal-menu/2026-07-01/rating',
        'mood-meal-employee-token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': 'mood-meal-employee-csrf'
            },
            body: JSON.stringify({
                food_score: 6,
                staff_score: 4,
                cleanliness_score: 5
            })
        }
    );
    assert.equal(invalidRating.status, 400);
    assert.equal((await invalidRating.json()).error, 'VALIDATION_ERROR');
});
