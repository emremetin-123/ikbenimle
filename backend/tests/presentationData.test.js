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
    MANIFEST_KEY,
    seedPresentationData,
    cleanupPresentationData
} = require('../scripts/presentation-data');

const count = async (db, table) => Number((await db.get(`SELECT COUNT(*) AS count FROM ${table}`)).count);

test('sunum verileri tekrar üretilebilir ve yalnız kendi kayıtlarını temizler', async t => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'presentation-data-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);

    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const admin = await db.run(`
        INSERT INTO users (employee_id, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?)
    `, ['presentation-admin', 'Sunum Yöneticisi', 'admin', 'active', '[]']);
    await db.run(
        'INSERT INTO company_news (title, content, created_by) VALUES (?, ?, ?)',
        ['Korunacak Haber', 'Bu kayıt sunum paketine ait değildir.', admin.lastID]
    );
    const existingCategory = await db.run(
        'INSERT INTO knowledge_categories (name, order_index) VALUES (?, ?)',
        ['İş Süreçleri', 99]
    );
    await db.run(
        'INSERT INTO meal_menus (meal_date, items, source_file, created_by) VALUES (?, ?, ?, ?)',
        ['2026-08-20', '["Mevcut Menü"]', 'existing.pdf', admin.lastID]
    );

    const seeded = await seedPresentationData(db, new Date('2026-08-20T09:00:00Z'));
    assert.equal(seeded.status, 'seeded');
    assert.equal((await seedPresentationData(db, new Date('2026-08-20T09:00:00Z'))).status, 'already_seeded');
    assert.equal(await count(db, 'announcements'), 3);
    assert.equal(await count(db, 'company_news'), 4);
    assert.equal(await count(db, 'knowledge_categories'), 3);
    assert.equal(await count(db, 'knowledge_items'), 9);
    assert.equal(await count(db, 'surveys'), 2);
    assert.equal(await count(db, 'survey_questions'), 7);
    assert.equal(await count(db, 'meal_menus'), 11);
    assert.equal(await count(db, 'app_settings'), 1);
    assert.equal(seeded.manifest.knowledge_categories.includes(existingCategory.lastID), false);
    assert.equal(seeded.manifest.meal_dates.includes('2026-08-20'), false);

    await db.run(`
        INSERT INTO meal_menu_ratings
            (meal_date, user_id, food_score, staff_score, cleanliness_score, comment)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [seeded.manifest.meal_dates[0], admin.lastID, 4, 5, 4, 'Sunum yorumu']);

    assert.equal((await cleanupPresentationData(db)).status, 'cleaned');
    assert.equal((await cleanupPresentationData(db)).status, 'not_seeded');
    assert.equal(await count(db, 'announcements'), 0);
    assert.equal(await count(db, 'company_news'), 1);
    assert.equal(await count(db, 'knowledge_categories'), 1);
    assert.equal(await count(db, 'knowledge_items'), 0);
    assert.equal(await count(db, 'surveys'), 0);
    assert.equal(await count(db, 'survey_questions'), 0);
    assert.equal(await count(db, 'meal_menus'), 1);
    assert.equal(await count(db, 'meal_menu_ratings'), 0);
    assert.equal(await count(db, 'app_settings'), 0);
    assert.equal((await db.get('SELECT title FROM company_news')).title, 'Korunacak Haber');
    assert.equal(await db.get('SELECT value FROM app_settings WHERE setting_key = ?', [MANIFEST_KEY]), undefined);
});
