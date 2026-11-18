const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const setupDb = require('../database');
const { runMigrations } = require('../migrations');
const { auditRelationIntegrity } = require('../scripts/audit-relation-integrity');

test('iliski denetimi FK migrationindan once orphan kayitlari raporlar', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'relation-audit-'));
    const previousDbType = process.env.DB_TYPE;
    const previousSqliteFilename = process.env.SQLITE_FILENAME;
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (previousDbType === undefined) delete process.env.DB_TYPE;
        else process.env.DB_TYPE = previousDbType;
        if (previousSqliteFilename === undefined) delete process.env.SQLITE_FILENAME;
        else process.env.SQLITE_FILENAME = previousSqliteFilename;
    });
    await runMigrations(db);
    await db.run('INSERT INTO users (employee_id, name, manager_id) VALUES (?, ?, ?)', ['orphan-user', 'Orphan User', 999999]);
    await db.run('INSERT INTO videos (title, parent_video_id) VALUES (?, ?)', ['Orphan Version', 999999]);
    await db.run(`INSERT INTO feedback (type, title, content, assigned_to_user_id)
                  VALUES (?, ?, ?, ?)`, ['suggestion', 'Orphan assignment', 'Test', 999999]);

    const results = await auditRelationIntegrity(db);
    assert.deepEqual(results.map(item => item.orphan_count), [1, 1, 1]);
});
