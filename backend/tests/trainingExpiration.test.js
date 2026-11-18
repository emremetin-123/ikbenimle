const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DB_TYPE = 'sqlite';
process.env.SEED_DEFAULT_USERS = 'false';
process.env.NODE_ENV = 'test';

const setupDb = require('../database');
const { runMigrations } = require('../migrations');
const {
    runExpiredReassignments
} = require('../modules/training/expiredTrainingWorker');

test('suresi dolan egitimler ekran acilmadan tum kullanicilar icin idempotent atanir', async t => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-expiry-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const user = await db.run(
        'INSERT INTO users (employee_id, name, status) VALUES (?, ?, ?)',
        ['expiry-user', 'Expiry User', 'active']
    );
    const video = await db.run(
        `INSERT INTO videos
            (title, auto_reassign_enabled, validity_amount, validity_unit, is_latest, is_active)
         VALUES (?, 1, 1, 'day', 1, 1)`,
        ['Expiry training']
    );
    await db.run(
        `INSERT INTO lessons (video_id, title, content_type, required_seconds, required_percent)
         VALUES (?, ?, 'video', 60, 100)`,
        [video.lastID, 'Lesson']
    );
    await db.run(
        `INSERT INTO assignments
            (user_id, video_id, training_root_id, status, completed_at, assigned_at)
         VALUES (?, ?, ?, 'completed', ?, ?)`,
        [user.lastID, video.lastID, video.lastID, '2026-01-01T00:00:00.000Z', '2025-12-01T00:00:00.000Z']
    );

    const first = await runExpiredReassignments(db);
    const second = await runExpiredReassignments(db);
    assert.equal(first.created, 1);
    assert.equal(second.created, 0);
    assert.equal(
        Number((await db.get(
            "SELECT COUNT(*) AS total FROM assignments WHERE status <> 'completed'"
        )).total),
        1
    );
});
