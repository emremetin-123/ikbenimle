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
const { assignTrainingUsers } = require('../modules/training/trainingAssignmentService');
const { createAdminTrainingAssignmentRepository } = require('../modules/training/adminTrainingAssignmentRepository');
const { createAdminTrainingAssignmentService } = require('../modules/training/adminTrainingAssignmentService');

test('toplu egitim atamasi atomik ve aktif egitim koku bazinda idempotenttir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-assignment-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const first = await db.run(
        'INSERT INTO users (employee_id, name, status) VALUES (?, ?, ?)',
        ['assign-1', 'Assign One', 'active']
    );
    const second = await db.run(
        'INSERT INTO users (employee_id, name, status) VALUES (?, ?, ?)',
        ['assign-2', 'Assign Two', 'active']
    );
    const rollbackUser = await db.run(
        'INSERT INTO users (employee_id, name, status) VALUES (?, ?, ?)',
        ['assign-rollback', 'Assign Rollback', 'active']
    );
    const root = await db.run(
        `INSERT INTO videos (title, version_no, is_latest, is_active)
         VALUES (?, 1, 0, 1)`,
        ['Versioned training']
    );
    const latest = await db.run(
        `INSERT INTO videos (title, version_no, parent_video_id, is_latest, is_active)
         VALUES (?, 2, ?, 1, 1)`,
        ['Versioned training v2', root.lastID]
    );
    await db.run(
        `INSERT INTO lessons (video_id, title, content_type, required_seconds, required_percent)
         VALUES (?, ?, 'video', 60, 100)`,
        [latest.lastID, 'Lesson']
    );

    let result = await assignTrainingUsers(db, {
        userIds: [first.lastID, second.lastID],
        videoId: root.lastID,
        dueDate: null
    });
    assert.deepEqual(result.created, [first.lastID, second.lastID]);
    assert.deepEqual(result.skipped, []);

    result = await assignTrainingUsers(db, {
        userIds: [first.lastID, second.lastID],
        videoId: latest.lastID,
        dueDate: null
    });
    assert.deepEqual(result.created, []);
    assert.deepEqual(result.skipped, [first.lastID, second.lastID]);

    await db.run("UPDATE assignments SET status = 'completed' WHERE user_id = ?", [first.lastID]);
    result = await assignTrainingUsers(db, {
        userIds: [first.lastID, second.lastID],
        videoId: latest.lastID,
        dueDate: null
    });
    assert.deepEqual(result.created, [first.lastID]);
    assert.deepEqual(result.skipped, [second.lastID]);

    await assert.rejects(
        assignTrainingUsers(db, {
            userIds: [rollbackUser.lastID, 999999],
            videoId: latest.lastID,
            dueDate: null
        }),
        /FOREIGN KEY/
    );
    assert.equal(
        Number((await db.get('SELECT COUNT(*) AS total FROM assignments WHERE user_id = ?', [rollbackUser.lastID])).total),
        0
    );
});

test('kaldirilan atama raporda iptal durumuna gecer ve tekrar kaldirilamaz', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-cancellation-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const admin = await db.run(
        'INSERT INTO users (employee_id, name, status) VALUES (?, ?, ?)',
        ['cancel-admin', 'Cancel Admin', 'active']
    );
    const employee = await db.run(
        'INSERT INTO users (employee_id, name, status) VALUES (?, ?, ?)',
        ['cancel-user', 'Cancel User', 'active']
    );
    const video = await db.run(
        'INSERT INTO videos (title, is_latest, is_active) VALUES (?, 1, 1)',
        ['Cancelled training']
    );
    const assignment = await db.run(
        `INSERT INTO assignments (user_id, video_id, training_root_id, status)
         VALUES (?, ?, ?, 'assigned')`,
        [employee.lastID, video.lastID, video.lastID]
    );
    const service = createAdminTrainingAssignmentService(
        createAdminTrainingAssignmentRepository(db)
    );

    assert.equal((await service.cancelAssignment(assignment.lastID, admin.lastID)).changes, 1);
    await assert.rejects(
        service.cancelAssignment(assignment.lastID, admin.lastID),
        error => error.status === 409 && error.code === 'ASSIGNMENT_ALREADY_CANCELLED'
    );

    const report = await service.listStats({
        page: 1,
        pageSize: 25,
        sort: 'assigned_at',
        order: 'desc'
    });
    assert.equal(report.items[0].status, 'cancelled');
    assert.equal(report.summary.cancelled, 1);
    assert.equal(report.summary.overdue, 0);

    const active = await service.listStats({
        page: 1,
        pageSize: 25,
        status: 'assigned',
        sort: 'assigned_at',
        order: 'desc'
    });
    assert.equal(active.items.length, 0);
});
