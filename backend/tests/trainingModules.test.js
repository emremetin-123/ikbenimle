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
const { MIGRATIONS } = require('../migrations');
const { setAuthDatabase } = require('../middleware/auth');
const createLearningRoutes = require('../modules/employee/learningRoutes');
const createAdminTrainingMutationRoutes = require('../modules/training/adminTrainingMutationRoutes');
const createAdminTrainingCatalogRoutes = require('../modules/training/adminTrainingCatalogRoutes');
const createAdminTrainingAssignmentRoutes = require('../modules/training/adminTrainingAssignmentRoutes');
const { parseTrainingContents, insertTrainingLessons } = require('../modules/training/trainingService');
const { trainingCreateBodySchema } = require('../modules/training/trainingSchemas');
const { createAdminTrainingMutationService } = require('../modules/training/adminTrainingMutationService');
const { createAuditMiddleware } = require('../modules/audit/auditMiddleware');

test('yerel eğitim videosu silinirken uploads dizinindeki fiziksel dosya temizlenir', async (t) => {
    const filename = `training-delete-${crypto.randomUUID()}.mp4`;
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'videos');
    const filePath = path.join(uploadsDir, filename);
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(filePath, 'test-video');
    t.after(() => fs.rmSync(filePath, { force: true }));

    let deletedVideoId = null;
    const repository = {
        countAssignments: async () => ({ count: 0 }),
        listLessonFiles: async () => [{ url: `/uploads/videos/${filename}` }],
        withTransaction: async callback => callback({
            deleteVideo: async videoId => { deletedVideoId = videoId; }
        })
    };

    const service = createAdminTrainingMutationService(repository);
    assert.deepEqual(await service.deleteVideo(42), { success: true });
    assert.equal(deletedVideoId, 42);
    assert.equal(fs.existsSync(filePath), false);
});

test('çok içerikli modül sırası ve modül sonu sınavı sunucuda korunur', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-modules-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);
    const user = await db.run(
        'INSERT INTO users (employee_id, name, status, permissions) VALUES (?, ?, ?, ?)',
        ['module-user', 'Module User', 'active', '["manage_education"]']
    );
    const video = await db.run(
        'INSERT INTO videos (title, requires_full_watch, requires_quiz, pass_score) VALUES (?, 0, 0, 70)',
        ['Modüllü Eğitim']
    );
    const quizData = { questions: [{ text: 'Doğru mu?', options: ['Evet', 'Hayır'], correct: 0 }] };
    const modules = [
        { title: 'İlk Modül', contents: [
            { title: 'PDF 1', content_type: 'pdf', url: 'https://example.test/1.pdf' },
            { title: 'PDF 2', content_type: 'pdf', url: 'https://example.test/2.pdf' }
        ], quizData },
        { title: 'İkinci Modül', contents: [
            { title: 'PDF 3', content_type: 'pdf', url: 'https://example.test/3.pdf' }
        ], quizData: null }
    ];
    const payload = { title: 'Modüllü Eğitim', training_profile: 'standard', modules };
    assert.equal(trainingCreateBodySchema.safeParse(payload).success, true);
    assert.equal(trainingCreateBodySchema.safeParse({ ...payload, training_profile: 'compliance' }).success, false);
    assert.equal(trainingCreateBodySchema.safeParse({
        ...payload,
        modules: [{ title: 'Karma Modül', contents: [
            { title: 'Video', content_type: 'video', url: 'https://example.test/video.mp4', required_seconds: 60 },
            { title: 'Sunum', content_type: 'pdf', url: 'https://example.test/slides.pdf' }
        ], quizData }]
    }).success, true);
    const contents = parseTrainingContents({ modules });
    await insertTrainingLessons(db, video.lastID, contents, [], []);
    const saved = await db.all('SELECT id, module_id, title FROM lessons WHERE video_id = ? ORDER BY order_index', [video.lastID]);
    assert.equal(saved.length, 3);
    assert.equal(saved[0].module_id, saved[1].module_id);
    assert.notEqual(saved[1].module_id, saved[2].module_id);

    const assignment = await db.run('INSERT INTO assignments (user_id, video_id) VALUES (?, ?)', [user.lastID, video.lastID]);
    const token = 'module-session';
    const csrf = 'module-csrf';
    const expiry = new Date(Date.now() + 3_600_000).toISOString();
    const hash = value => crypto.createHash('sha256').update(value).digest('hex');
    await db.run(
        'INSERT INTO auth_sessions (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at) VALUES (?, ?, ?, ?, ?)',
        [hash(token), hash(csrf), user.lastID, expiry, expiry]
    );
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    const journal = createAuditMiddleware(db);
    app.use(journal.middleware);
    app.use('/api', createLearningRoutes(db));
    app.use('/api/admin', createAdminTrainingMutationRoutes(db));
    app.use('/api/admin', createAdminTrainingCatalogRoutes(db));
    app.use('/api/admin', createAdminTrainingAssignmentRoutes(db));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code || 'INTERNAL_SERVER_ERROR' }));
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await journal.drain();
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
    const request = async (endpoint, body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${endpoint}`, {
        method: 'POST',
        headers: { Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      await journal.drain();
      return response;
    };
    const complete = id => request(`/lesson/${id}/watch`, { content_completed: true, page_number: 1, page_count: 1 });
    const quiz = () => request(`/lesson/${saved[1].id}/quiz`, { answers: { 0: 0 } });

    assert.equal((await request(`/lesson/${saved[1].id}/watch/start`)).status, 409);
    assert.equal((await complete(saved[2].id)).status, 409);
    assert.equal((await quiz()).status, 409);
    assert.equal((await complete(saved[0].id)).status, 200);
    assert.equal((await complete(saved[1].id)).status, 200);
    assert.equal((await quiz()).status, 200);
    assert.equal((await complete(saved[2].id)).status, 200);
    assert.equal((await db.get('SELECT status FROM assignments WHERE id = ?', [assignment.lastID])).status, 'completed');
    await db.run("UPDATE assignments SET status = 'assigned' WHERE id = ?", [assignment.lastID]);
    const confirmation = await request(`/assignment/${assignment.lastID}/confirm`);
    assert.equal(confirmation.status, 200, await confirmation.text());
    const confirmedAssignment = await db.get(
        'SELECT confirmed_at, reference_id FROM assignments WHERE id = ?',
        [assignment.lastID]
    );
    assert.ok(confirmedAssignment.confirmed_at);
    assert.match(confirmedAssignment.reference_id, /^CERT-\d{8}-[A-F0-9]{32}$/);
    const evidencePdf = await fetch(
        `http://127.0.0.1:${server.address().port}/api/admin/assignments/${assignment.lastID}/evidence.pdf`,
        { headers: { Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}` } }
    );
    assert.equal(evidencePdf.status, 200, await evidencePdf.clone().text());
    assert.match(evidencePdf.headers.get('content-type'), /^application\/pdf/);
    assert.equal(Buffer.from(await evidencePdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');

    const createForm = new FormData();
    createForm.set('awards_badge', 'false');
    createForm.set('title', 'API Eğitimi');
    createForm.set('training_profile', 'standard');
    createForm.set('requires_quiz', 'false');
    createForm.set('modules', JSON.stringify(modules));
    const adminFetch = async (method, endpoint, body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin${endpoint}`, {
        method,
        headers: { Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`, 'X-CSRF-Token': csrf },
        body
      });
      await journal.drain();
      return response;
    };
    const createdResponse = await adminFetch('POST', '/video', createForm);
    assert.equal(createdResponse.status, 200, await createdResponse.text());
    const created = await db.get("SELECT id FROM videos WHERE title = 'API Eğitimi'");
    const adminDetail = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/video/${created.id}`, {
        headers: { Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}` }
    });
    assert.equal(adminDetail.status, 200);
    const detail = await adminDetail.json();
    assert.equal(detail.lessons.length, 3);
    assert.equal(detail.lessons[0].module_title, 'İlk Modül');
    assert.equal(detail.lessons[1].title, 'PDF 2');
    assert.equal(detail.lessons[1].quizData.questions.length, 1);

    const updatedModules = [{ title: 'Yeni Modül', contents: [{ title: 'Yeni PDF', content_type: 'pdf', url: 'https://example.test/new.pdf' }], quizData: null }];
    const updateForm = new FormData();
    updateForm.set('awards_badge', 'false');
    updateForm.set('title', 'API Eğitimi');
    updateForm.set('training_profile', 'standard');
    updateForm.set('requires_quiz', 'false');
    updateForm.set('modules', JSON.stringify(updatedModules));
    const updatedResponse = await adminFetch('PUT', `/video/${created.id}`, updateForm);
    assert.equal(updatedResponse.status, 200, await updatedResponse.text());
    const updated = await db.all('SELECT l.title, m.title AS module_title FROM lessons l JOIN training_modules m ON m.id = l.module_id WHERE l.video_id = ?', [created.id]);
    assert.deepEqual(updated, [{ title: 'Yeni PDF', module_title: 'Yeni Modül' }]);

    await db.run('INSERT INTO assignments (user_id, video_id) VALUES (?, ?)', [user.lastID, created.id]);
    const versionForm = new FormData();
    versionForm.set('awards_badge', 'false');
    versionForm.set('title', 'API Eğitimi');
    versionForm.set('training_profile', 'standard');
    versionForm.set('requires_quiz', 'false');
    versionForm.set('modules', JSON.stringify(modules));
    const versionResponse = await adminFetch('PUT', `/video/${created.id}`, versionForm);
    assert.equal(versionResponse.status, 200, await versionResponse.text());
    const versions = await db.all('SELECT id, version_no FROM videos WHERE id = ? OR parent_video_id = ? ORDER BY version_no', [created.id, created.id]);
    assert.deepEqual(versions.map(row => row.version_no), [1, 2]);
    assert.equal((await db.get('SELECT COUNT(*) AS total FROM lessons WHERE video_id = ?', [created.id])).total, 1);
    assert.equal((await db.get('SELECT COUNT(*) AS total FROM lessons WHERE video_id = ?', [versions[1].id])).total, 3);
    const latestQuiz = await db.get(
        `SELECT q.data FROM quizzes q
         JOIN lessons l ON l.id = q.lesson_id
         WHERE l.video_id = ?`,
        [versions[1].id]
    );
    assert.equal(JSON.parse(latestQuiz.data).questions[0].text, 'Doğru mu?');

    const videoCourse = await db.run(
        'INSERT INTO videos (title, requires_full_watch, requires_quiz, minimum_watch_percent, pass_score) VALUES (?, 1, 1, 100, 70)',
        ['İki Videolu Eğitim']
    );
    await insertTrainingLessons(db, videoCourse.lastID, parseTrainingContents({ modules: [{
        title: 'Video Modülü',
        contents: [
            { title: 'Birinci Video', content_type: 'video', url: 'https://example.test/first.mp4', required_seconds: 2 },
            { title: 'İkinci Video', content_type: 'video', url: 'https://example.test/second.mp4', required_seconds: 2 }
        ],
        quizData
    }] }), [], []);
    const videoLessons = await db.all('SELECT id FROM lessons WHERE video_id = ? ORDER BY order_index', [videoCourse.lastID]);
    await db.run('INSERT INTO assignments (user_id, video_id) VALUES (?, ?)', [user.lastID, videoCourse.lastID]);
    assert.equal((await request(`/lesson/${videoLessons[1].id}/watch/start`)).status, 409);
    for (const [index, item] of videoLessons.entries()) {
        const start = await request(`/lesson/${item.id}/watch/start`);
        assert.equal(start.status, 200);
        const { progress_token } = await start.json();
        const watchBody = {
            progress_token, video_completed: true, watched_seconds: 2,
            last_position: 2, max_position: 2, duration_seconds: 2, is_playing: true
        };
        const early = await request(`/lesson/${item.id}/watch`, { ...watchBody, last_position: 0 });
        assert.equal((await early.json()).status, 'assigned');
        await db.run(
            'UPDATE training_progress_sessions SET last_heartbeat_at = ? WHERE lesson_id = ?',
            [new Date(Date.now() - 3_000).toISOString(), item.id]
        );
        const later = await request(`/lesson/${item.id}/watch`, watchBody);
        assert.equal((await later.json()).status, index === 0 ? 'completed' : 'watched');
    }
    assert.equal((await request(`/lesson/${videoLessons[1].id}/quiz`, { answers: { 0: 0 } })).status, 200);

    const legacyVideo = await db.run(
        'INSERT INTO videos (title, requires_full_watch, minimum_watch_percent, certificate_enabled) VALUES (?, 1, 100, 1)',
        ['Boş Quiz Kayıtlı Eğitim']
    );
    const legacyLesson = await db.run(
        'INSERT INTO lessons (video_id, title, url, content_type, required_seconds, order_index) VALUES (?, ?, ?, ?, ?, 0)',
        [legacyVideo.lastID, 'Tek Video', 'https://example.test/legacy.mp4', 'video', 2]
    );
    await db.run(
        'INSERT INTO quizzes (video_id, lesson_id, data) VALUES (?, ?, ?)',
        [legacyVideo.lastID, legacyLesson.lastID, '{}']
    );
    const legacyAssignment = await db.run(
        'INSERT INTO assignments (user_id, video_id) VALUES (?, ?)',
        [user.lastID, legacyVideo.lastID]
    );
    const legacyStart = await request(`/lesson/${legacyLesson.lastID}/watch/start`);
    const legacyProgressToken = (await legacyStart.json()).progress_token;
    await db.run(
        'UPDATE training_progress_sessions SET last_heartbeat_at = ? WHERE lesson_id = ?',
        [new Date(Date.now() - 3_000).toISOString(), legacyLesson.lastID]
    );
    const legacyWatch = await request(`/lesson/${legacyLesson.lastID}/watch`, {
        progress_token: legacyProgressToken,
        video_completed: true,
        watched_seconds: 2,
        last_position: 2,
        max_position: 2,
        duration_seconds: 2,
        is_playing: true
    });
    const legacyWatchBody = await legacyWatch.json();
    assert.equal(legacyWatch.status, 200, JSON.stringify(legacyWatchBody));
    assert.equal(legacyWatchBody.status, 'completed');
    assert.equal(
        (await db.get('SELECT status FROM assignments WHERE id = ?', [legacyAssignment.lastID])).status,
        'completed'
    );
    const legacyConfirmation = await request(`/assignment/${legacyAssignment.lastID}/confirm`);
    assert.equal(legacyConfirmation.status, 200, await legacyConfirmation.text());
});

test('eski tek içerikli dersler modüle veri kaybı olmadan bağlanır', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-module-backfill-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
    await MIGRATIONS[0].up(db, 'sqlite');
    const video = await db.run('INSERT INTO videos (title) VALUES (?)', ['Eski Eğitim']);
    const lesson = await db.run(
        'INSERT INTO lessons (video_id, title, url, order_index) VALUES (?, ?, ?, 0)',
        [video.lastID, 'Eski Ders', 'https://example.test/old.mp4']
    );
    await db.run('INSERT INTO quizzes (video_id, lesson_id, data) VALUES (?, ?, ?)', [video.lastID, lesson.lastID, '{}']);
    const moduleMigration = MIGRATIONS.find(migration => migration.version === '020_training_modules');
    await moduleMigration.up(db, 'sqlite');
    const migrated = await db.get(
        'SELECT l.id, l.url, m.title AS module_title FROM lessons l JOIN training_modules m ON m.id = l.module_id WHERE l.id = ?',
        [lesson.lastID]
    );
    assert.equal(migrated.module_title, 'Eski Ders');
    assert.equal(migrated.url, 'https://example.test/old.mp4');
    assert.equal((await db.get('SELECT lesson_id FROM quizzes WHERE lesson_id = ?', [lesson.lastID])).lesson_id, lesson.lastID);
    await moduleMigration.down(db);
    assert.equal((await db.get('SELECT title FROM lessons WHERE id = ?', [lesson.lastID])).title, 'Eski Ders');
});
