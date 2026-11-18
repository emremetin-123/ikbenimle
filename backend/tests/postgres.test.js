const test = require('node:test');
const assert = require('node:assert/strict');
const { connectPostgres } = require('../db/connectPostgres');
const { runMigrations, migrationStatus } = require('../migrations');
const { createAdminTrainingCatalogRepository } = require('../modules/training/adminTrainingCatalogRepository');
const { createAdminTrainingCatalogService } = require('../modules/training/adminTrainingCatalogService');
const { createEmployeeLearningRepository } = require('../modules/employee/employeeLearningRepository');
const { createEmployeeLearningService } = require('../modules/employee/employeeLearningService');

const postgresUrl = process.env.POSTGRES_TEST_URL;

test('PostgreSQL migration, CRUD ve transaction sözleşmesini destekler', {
    skip: !postgresUrl
}, async () => {
    const previous = {
        DB_TYPE: process.env.DB_TYPE,
        DATABASE_URL: process.env.DATABASE_URL,
        DB_SSL: process.env.DB_SSL
    };
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = postgresUrl;
    process.env.DB_SSL = 'false';

    const db = await connectPostgres();
    try {
        await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await runMigrations(db);

        const status = await migrationStatus(db);
        assert.ok(status.length > 0);
        assert.ok(status.every(item => item.applied));

        const inserted = await db.run(
            `INSERT INTO users (employee_id, name, status, role, permissions)
             VALUES (?, ?, ?, ?, ?)`,
            ['pg-test', 'PostgreSQL Test', 'active', 'employee', '[]']
        );
        assert.ok(Number(inserted.lastID) > 0);
        assert.equal(inserted.changes, 1);

        const user = await db.get('SELECT employee_id, name FROM users WHERE id = ?', [inserted.lastID]);
        assert.equal(user.employee_id, 'pg-test');

        const video = await db.run(
            'INSERT INTO videos (title, requires_full_watch, minimum_watch_percent) VALUES (?, 0, 0)',
            ['PostgreSQL Quiz Eğitimi']
        );
        const moduleRow = await db.run(
            'INSERT INTO training_modules (video_id, title, order_index) VALUES (?, ?, 0)',
            [video.lastID, 'Quiz Modülü']
        );
        const lesson = await db.run(
            `INSERT INTO lessons (video_id, module_id, title, url, content_type, order_index)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [video.lastID, moduleRow.lastID, 'Quiz Videosu', '/uploads/videos/quiz.mp4', 'video']
        );
        const quiz = { questions: [{ text: 'Soru?', options: ['Evet', 'Hayır'], correct: 0 }] };
        await db.run(
            'INSERT INTO quizzes (video_id, lesson_id, data) VALUES (?, ?, ?)',
            [video.lastID, lesson.lastID, JSON.stringify(quiz)]
        );
        await db.run(
            'INSERT INTO assignments (user_id, video_id) VALUES (?, ?)',
            [inserted.lastID, video.lastID]
        );

        const catalogService = createAdminTrainingCatalogService(
            createAdminTrainingCatalogRepository(db)
        );
        const catalogDetail = await catalogService.getVideo(video.lastID);
        assert.deepEqual(catalogDetail.lessons[0].quizData, quiz);

        const learningService = createEmployeeLearningService(
            db,
            createEmployeeLearningRepository(db)
        );
        const employeeDetail = await learningService.getVideoDetail(video.lastID, inserted.lastID);
        assert.equal(employeeDetail.status, 200);
        assert.deepEqual(employeeDetail.body.lessons[0].quiz.questions, [
            { text: 'Soru?', options: ['Evet', 'Hayır'] }
        ]);

        await assert.rejects(
            db.transaction(async tx => {
                await tx.run(
                    'INSERT INTO users (employee_id, name) VALUES (?, ?)',
                    ['pg-rollback', 'Rollback Test']
                );
                throw new Error('ROLLBACK_TEST');
            }),
            /ROLLBACK_TEST/
        );
        assert.equal(
            Number((await db.get('SELECT COUNT(*) AS total FROM users WHERE employee_id = ?', ['pg-rollback'])).total),
            0
        );
    } finally {
        await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await db.close();
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});
