const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

process.env.DB_TYPE = 'sqlite';
process.env.SEED_DEFAULT_USERS = 'false';
process.env.NODE_ENV = 'test';

const setupDb = require('../database');
const {
    runMigrations,
    migrationStatus,
    rollbackMigrations
} = require('../migrations');
const { createUserRepository } = require('../modules/users/userRepository');
const { createUserService } = require('../modules/users/userService');
const { createPolyvalenceRepository } = require('../modules/polyvalence/polyvalenceRepository');
const { createFeedbackRepository } = require('../modules/feedback/feedbackRepository');
const { createFeedbackService } = require('../modules/feedback/feedbackService');
const { buildPolyvalenceDashboard } = require('../modules/polyvalence/dashboardService');
const createPolyvalenceRouter = require('../routes/polyvalence');
const createAdminRouter = require('../routes/admin');
const createEmployeeRouter = require('../routes/employee');
const createPersonalInfoRouter = require('../routes/personalInfo');
const {
    createAdminFeedbackRouter,
    createEmployeeFeedbackRouter
} = require('../routes/feedback');
const createAnnouncementRouter = require('../routes/announcements');
const createNewsRouter = require('../routes/news');
const createSurveyRouter = require('../routes/surveys');
const createCareersRouter = require('../routes/careers');
const createLeaveRouter = require('../routes/leave');
const createDirectoryRouter = require('../routes/directory');
const createKnowledgeRouter = require('../routes/knowledge');
const createServiceRoutesRouter = require('../routes/serviceRoutes');
const createNotificationsRouter = require('../routes/notifications');
const { setAuthDatabase } = require('../middleware/auth');
const {
    metricsMiddleware,
    metricsHandler,
    metricsAccess
} = require('../middleware/metrics');
const { privateFileHandler } = require('../middleware/privateFiles');
const { getSettings, setSetting } = require('../services/appSettingsService');
const { readBackupHealth, MAX_BACKUP_AGE_SECONDS } = require('../services/backupHealthService');
const { errorContractMiddleware } = require('../middleware/errorContract');

const EXPECTED_MIGRATION_CHECKSUMS = [
    '1f1c106c3f2a0a10a12c64c4c46633afeea05620a2710d8b4247ffcbe2a940ba',
    'b039b6d393f64af0d460cd0a18ff47383b9d7a4ab3e8ac5590f0c4c572e8950b',
    'fab3742a46d4c8c6ece6d076bf5dd3e7' + '1452630f4796ccd7e82c86b28a65b2d0',
    'f9baa297bc3de3e663a031a623edcbcd0dca5e9b4ce41f16c06c16f53dd10c3a',
    'da17378f78e0b64298e08d1eb6cfbe5823f7dfb32e2e288c1068b2dd9c3c11f1',
    'ab160b10889471ba2ee5d800bcd596ed807dbb8a29519ad6433743eec051fcdf',
    'e98ec04dd1acee1efba5f5242aa086a9af4d7703b7cbbb05dc50a6fea92706a8',
    '3b677215c2073bd541ef7071ddf03e18' + 'bb85a2ad8d354a9cde51e54f68207572',
    '58b28ff2094def6e961a4c9d47c460c818a29fefa67a05d3ff81e0fdd9c0b598',
    '452ac53b34ae04561438e0c35b543ebda7b4f959119609abbf5eac407167211e',
    'f19368a13a733d23f15fb6948c03d2bd708516df78ad2c98a87eebe266067485',
    '66bc6422d3dbded5ad6ea26f8f36697e2a97e52ee278058510bb355330562468',
    'e86d996f907e9e93691fc1d21b6702f9e0efcd94c596b44cca32629f663d7077',
    'f9aa7e804114b5873c8be6109a06a8ecdd04e84b46e7b5d3f44725c690d3bff8',
    '415c2553d06b21b11247f6796cf800a80358455a0dd49c6b2710e19e578ecf57',
    '888d2e74ee5f9a0279a131d045e67a3' + '0c99554d51f7b25bc245dd9309ce655bc',
    'fcaad7e3db1b28ebae9e8428593123d73b1b68247bcdba890b87c38ef698a4df',
    '9a8a616c4e5f7811e48b3cb458d08411d9617a7b549638f4d0c0e6a982ad9134',
    '9e7f6cff8550d10b921e37cba39ceb719652936cd14becf933ab2b313b2283ad',
    '6fa53caa74e996d08e2f96a849c293e3f3da07a1799b13283e938bb5b3490e54',
    '5028e8f922fd0d75650ffb219d8ca73291b3eb41fd43464c335fb4ecd678c099',
    'd0109ec735fc2461002c31f1979edd97dd2723ef020322fcd4a9760bebd63fb4',
    '0992f6c2451e4e267764adf071f0dca52f0de8b87581f371e9fe6aa93716f4f9',
    '00775177555d7e3b0e2a08453616d0fc4f9826ae39846ccb3c402fb78d967104',
    '64f61085da3fb010939a75c017630f485abe7992a003a530d4b7521160fb3212',
    'fe80af0cb84718c671ca093eb5f33ef99360776b6d603fe235b6e7fb52ae5b82',
    '6203b3bf5ddf72ab26405449e16ec77da0210949dfdf9e7d70ca5af78b33f040'
];

test('polivalans router fabrikasi her mount icin ayri router uretir', () => {
    const db = {};
    assert.notEqual(createPolyvalenceRouter(db), createPolyvalenceRouter(db));
});

test('domainlere ayrilan migration checksumlari canli kayitlarla uyumludur', () => {
    for (const [index, migration] of require('../migrations').MIGRATIONS.entries()) {
        const checksum = crypto.createHash('sha256')
            .update(
                `${migration.version}\n${migration.up.toString()}\n${migration.down?.toString() || ''}`
                + (migration.checksumMaterial ? `\n${migration.checksumMaterial}` : '')
            )
            .digest('hex');
        assert.equal(checksum, EXPECTED_MIGRATION_CHECKSUMS[index]);
    }
});

test('polivalans donem katmanlari mimari sinirlari korur', () => {
    const periodDir = path.join(__dirname, '..', 'modules', 'polyvalence', 'periods');
    const files = ['periodRoutes.js', 'periodService.js', 'periodRepository.js'];
    for (const file of files) {
        const source = fs.readFileSync(path.join(periodDir, file), 'utf8');
        assert.ok(
            source.split(/\r?\n/).length <= 500,
            `${file} 500 satirlik mimari siniri asiyor`
        );
    }
    for (const file of ['periodRoutes.js', 'periodService.js']) {
        const source = fs.readFileSync(path.join(periodDir, file), 'utf8');
        assert.doesNotMatch(
            source,
            /\bdb\.(all|get|run|transaction)\s*\(/,
            `${file} repository disinda dogrudan SQL erisimi yapiyor`
        );
    }
});

test('buyuk backend sorumluluklari 500 satirlik moduler siniri korur', () => {
    const backendRoot = path.join(__dirname, '..');
    const collectFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const target = path.join(directory, entry.name);
            return entry.isDirectory() ? collectFiles(target) : [target];
        });
    const files = [
        ...collectFiles(path.join(backendRoot, 'routes')),
        ...collectFiles(path.join(backendRoot, 'modules'))
            .filter(file => /(?:Routes|Controller)\.js$/i.test(file)),
        ...[
            'db/connectSqlite.js',
            'db/connectPostgres.js',
            'db/seeds/runDevelopmentSeeds.js',
            'db/schema/sqlite/peopleAndTrainingSchema.js',
            'db/schema/sqlite/operationsSchema.js',
            'db/schema/sqlite/polyvalenceSchema.js',
            'migrations/legacy/sqliteUpgrades.js',
            'db/schema/postgres/peopleAndTrainingSchema.js',
            'db/schema/postgres/operationsSchema.js',
            'db/schema/postgres/polyvalenceSchema.js'
        ].map(file => path.join(backendRoot, file))
    ];

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        assert.ok(
            source.split(/\r?\n/).length <= 500,
            `${path.relative(backendRoot, file)} 500 satirlik mimari siniri asiyor`
        );
    }

    for (const connector of ['db/connectSqlite.js', 'db/connectPostgres.js']) {
        const source = fs.readFileSync(path.join(__dirname, '..', connector), 'utf8');
        assert.ok(
            source.split(/\r?\n/).length <= 300,
            `${connector} baglanti orkestrasyonu sinirini asiyor`
        );
        assert.doesNotMatch(source, /CREATE TABLE|ALTER TABLE/);
    }
});

test('push teslimati ve zamanlanmis bildirimler ayri sorumluluklarda kalir', () => {
    const servicesRoot = path.join(__dirname, '..', 'services');
    const facade = fs.readFileSync(
        path.join(servicesRoot, 'pushNotificationService.js'),
        'utf8'
    );
    const delivery = fs.readFileSync(
        path.join(servicesRoot, 'pushDeliveryService.js'),
        'utf8'
    );
    const scheduler = fs.readFileSync(
        path.join(servicesRoot, 'notificationSchedulerService.js'),
        'utf8'
    );

    assert.ok(facade.split(/\r?\n/).length <= 30, 'push facade is kurali tasimamali');
    assert.ok(delivery.split(/\r?\n/).length <= 250, 'push teslimat servisi yeniden buyudu');
    assert.ok(scheduler.split(/\r?\n/).length <= 350, 'bildirim scheduler servisi yeniden buyudu');
    assert.doesNotMatch(delivery, /setInterval|scheduler_locks/);
    assert.doesNotMatch(scheduler, /webpush\.sendNotification|push_subscriptions/);
});

test('katmanlandirilan route dosyalari SQL ve is kurali tasimaz', () => {
    const routesDirectory = path.join(__dirname, '..', 'routes');
    const employeeDirectory = path.join(__dirname, '..', 'modules', 'employee');
    const polyvalenceDirectory = path.join(__dirname, '..', 'modules', 'polyvalence');
    const personalInfoDirectory = path.join(__dirname, '..', 'modules', 'personalInfo');
    const surveysDirectory = path.join(__dirname, '..', 'modules', 'surveys');
    const trainingDirectory = path.join(__dirname, '..', 'modules', 'training');
    const collectRouteFiles = directory => fs.readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const target = path.join(directory, entry.name);
            if (entry.isDirectory()) return collectRouteFiles(target);
            return entry.name.endsWith('Routes.js') ? [target] : [];
        });
    const routeFiles = [
        ...fs.readdirSync(routesDirectory)
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(routesDirectory, file)),
        ...fs.readdirSync(employeeDirectory)
            .filter(file => file.endsWith('Routes.js'))
            .map(file => path.join(employeeDirectory, file)),
        ...collectRouteFiles(polyvalenceDirectory),
        ...collectRouteFiles(personalInfoDirectory),
        ...collectRouteFiles(surveysDirectory),
        ...collectRouteFiles(trainingDirectory)
    ];
    for (const file of routeFiles) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(
            source,
            /\bdb\.(all|get|run|transaction)\s*\(|\bSELECT\b|\bINSERT\s+INTO\b|\bUPDATE\b|\bDELETE\s+FROM\b/,
            `${path.basename(file)} HTTP katmani disinda sorumluluk tasiyor`
        );
    }
});

test('kisisel bilgi service katmani SQL tasimaz', () => {
    const directory = path.join(__dirname, '..', 'modules', 'personalInfo');
    const serviceFiles = fs.readdirSync(directory).filter(file => file.endsWith('Service.js'));
    for (const file of serviceFiles) {
        const source = fs.readFileSync(path.join(directory, file), 'utf8');
        assert.doesNotMatch(
            source,
            /\b(?:db|tx)\.(all|get|run|exec|transaction)\s*\(|\bSELECT\b|\bINSERT\s+INTO\b|\bUPDATE\b|\bDELETE\s+FROM\b/,
            `${file} repository sorumlulugu tasiyor`
        );
    }
});

test('egitim service ve worker katmani SQL tasimaz', () => {
    const trainingDirectory = path.join(__dirname, '..', 'modules', 'training');
    const serviceFiles = fs.readdirSync(trainingDirectory)
        .filter(file => file.endsWith('Service.js') || file.endsWith('Worker.js'));
    for (const file of serviceFiles) {
        const source = fs.readFileSync(path.join(trainingDirectory, file), 'utf8');
        assert.doesNotMatch(
            source,
            /\b(?:db|tx)\.(all|get|run|exec|transaction)\s*\(|\bSELECT\b|\bINSERT\s+INTO\b|\bUPDATE\b|\bDELETE\s+FROM\b/,
            `${file} repository sorumlulugu tasiyor`
        );
    }
});

const listen = (app) => new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

test('kullanici ve geri bildirim listeleri zorunlu sayfali sozlesme kullanir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-users-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    const service = createUserService(createUserRepository(db));

    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    for (const [employeeId, name, department] of [
        ['u-1', 'Ayse Test', 'Pres'],
        ['u-2', 'Berk Test', 'Pres'],
        ['u-3', 'Cem Test', 'YBS']
    ]) {
        await db.run(
            'INSERT INTO users (employee_id, name, department, status, role) VALUES (?, ?, ?, ?, ?)',
            [employeeId, name, department, 'active', 'employee']
        );
    }

    const firstPage = await service.list({});
    assert.equal(firstPage.items.length, 3);
    assert.deepEqual(firstPage.pagination, {
        page: 1,
        pageSize: 25,
        total: 3,
        totalPages: 1
    });

    const paged = await service.list({ page: '1', pageSize: '2', department: 'Pres' });
    assert.equal(paged.items.length, 2);
    assert.deepEqual(paged.pagination, {
        page: 1,
        pageSize: 2,
        total: 2,
        totalPages: 1
    });

    await db.run(
        'INSERT INTO feedback (user_id, type, title, content, status) VALUES (?, ?, ?, ?, ?)',
        [firstPage.items[0].id, 'suggestion', 'Test onerisi', 'Aciklama', 'pending']
    );
    const feedbackService = createFeedbackService(createFeedbackRepository(db));
    const feedbackPage = await feedbackService.listAdmin({
        page: '1',
        pageSize: '10',
        search: 'Test onerisi'
    });
    assert.equal(feedbackPage.items.length, 1);
    assert.equal(feedbackPage.pagination.total, 1);
});

test('egitim katalogu ve belge talepleri HTTP seviyesinde sayfalanir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-pagination-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const user = await db.run(
        `INSERT INTO users
            (employee_id, name, role, status, permissions, department, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['pagination-admin', 'Pagination Admin', 'admin', 'active', '[]', 'Pagination', 'Tester']
    );
    const token = 'pagination-session-token';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const csrfHash = crypto.createHash('sha256').update('pagination-csrf-token').digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.run(
        `INSERT INTO auth_sessions
            (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [tokenHash, csrfHash, user.lastID, expiry, expiry]
    );
    const type = await db.run(
        'INSERT INTO document_request_types (name, is_active) VALUES (?, ?)',
        ['Gelir Belgesi', 1]
    );
    for (let index = 1; index <= 3; index += 1) {
        await db.run(
            'INSERT INTO document_requests (user_id, type_id, status, answers_json) VALUES (?, ?, ?, ?)',
            [user.lastID, type.lastID, 'Beklemede', JSON.stringify({ index })]
        );
        const video = await db.run(
            `INSERT INTO videos
                (title, category, is_latest, is_active, auto_reassign_enabled, validity_amount, validity_unit)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                `Egitim ${index}`,
                'Genel',
                1,
                1,
                index === 3 ? 1 : 0,
                index === 3 ? 1 : null,
                index === 3 ? 'day' : null
            ]
        );
        await db.run(
            `INSERT INTO assignments
                (user_id, video_id, status, completed_at)
             VALUES (?, ?, ?, ?)`,
            [
                user.lastID,
                video.lastID,
                index === 3 ? 'completed' : 'assigned',
                index === 3 ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() : null
            ]
        );
    }

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/admin', createAdminRouter(db));
    app.use('/api', createEmployeeRouter(db));
    app.use('/api', createPersonalInfoRouter(db));
    app.use('/api/feedback', createEmployeeFeedbackRouter(db));
    app.use('/api/admin/feedback', createAdminFeedbackRouter(db));
    app.use('/api/polyvalence', createPolyvalenceRouter(db));
    const server = await listen(app);
    const cookie = `ikbenimle_session=${token}`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const requestJson = async (url) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
            headers: { Cookie: cookie }
        });
        assert.equal(response.status, 200);
        return response.json();
    };

    const videos = await requestJson('/api/admin/all-videos?page=1&pageSize=2');
    assert.equal(videos.items.length, 2);
    assert.deepEqual(videos.pagination, {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
    const videoOptions = await requestJson(
        '/api/admin/all-videos/options?page=2&pageSize=2'
    );
    assert.equal(videoOptions.items.length, 1);
    assert.deepEqual(videoOptions.pagination, {
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
    const searchedVideoOptions = await requestJson(
        '/api/admin/all-videos/options?page=1&pageSize=25&search=Egitim%203'
    );
    assert.equal(searchedVideoOptions.items.length, 1);
    const assignmentUsers = await requestJson(
        '/api/admin/assignment-user-options?page=1&pageSize=1&search=Pagination'
    );
    assert.equal(assignmentUsers.items.length, 1);
    assert.equal(assignmentUsers.pagination.total, 1);
    const assignmentFilters = await requestJson('/api/admin/assignment-user-filters');
    assert.ok(assignmentFilters.departments.includes('Pagination'));
    assert.ok(assignmentFilters.positions.includes('Tester'));

    for (const endpoint of [
        '/api/admin/users/options?page=1&pageSize=1',
        '/api/admin/feedback/user-options?page=1&pageSize=1',
        '/api/admin/document-user-options?page=1&pageSize=1'
    ]) {
        const options = await requestJson(endpoint);
        assert.equal(options.items.length, 1);
        assert.deepEqual(options.pagination, {
            page: 1,
            pageSize: 1,
            total: 1,
            totalPages: 1
        });
    }
    const searchedDocumentUsers = await requestJson(
        '/api/admin/document-user-options?page=1&pageSize=25&search=Tester'
    );
    assert.equal(searchedDocumentUsers.items.length, 1);
    assert.equal(searchedDocumentUsers.items[0].employee_id, 'pagination-admin');
    const searchedFeedbackUsers = await requestJson(
        '/api/admin/feedback/user-options?page=1&pageSize=25&search=Tester'
    );
    assert.equal(searchedFeedbackUsers.items.length, 1);
    assert.equal(searchedFeedbackUsers.items[0].employee_id, 'pagination-admin');
    const searchedAdminUsers = await requestJson(
        '/api/admin/users/options?page=1&pageSize=25&search=Tester'
    );
    assert.equal(searchedAdminUsers.items.length, 1);
    const adminUserFormOptions = await requestJson('/api/admin/users/form-options');
    assert.ok(adminUserFormOptions.departments.includes('Pagination'));
    assert.ok(adminUserFormOptions.positions.includes('Tester'));

    const compactSetup = await requestJson(
        '/api/polyvalence/admin/setup?includeLarge=false'
    );
    assert.equal(typeof compactSetup.active_membership_count, 'number');
    const searchedMemberships = await requestJson(
        '/api/polyvalence/admin/setup?resource=memberships&page=1&pageSize=25&search=Pagination'
    );
    assert.equal(searchedMemberships.pagination.page, 1);
    const searchedPolyvalenceUsers = await requestJson(
        '/api/polyvalence/admin/setup?resource=users&page=1&pageSize=25&search=Tester'
    );
    assert.equal(searchedPolyvalenceUsers.items.length, 1);
    assert.equal(searchedPolyvalenceUsers.items[0].employee_id, 'pagination-admin');
    assert.deepEqual(compactSetup.users, []);
    assert.deepEqual(compactSetup.memberships, []);
    const setupUsers = await requestJson(
        '/api/polyvalence/admin/setup?resource=users&page=1&pageSize=1'
    );
    assert.equal(setupUsers.items.length, 1);
    assert.equal(setupUsers.pagination.total, 1);
    const setupMemberships = await requestJson(
        '/api/polyvalence/admin/setup?resource=memberships&page=1&pageSize=1'
    );
    assert.deepEqual(setupMemberships.items, []);
    assert.equal(setupMemberships.pagination.total, 0);

    const [trainingSummary, pendingTrainings] = await Promise.all([
        requestJson('/api/videos/summary'),
        requestJson('/api/videos?status=pending&page=1&pageSize=1')
    ]);
    assert.deepEqual(trainingSummary, {
        total: 3,
        completed: 1,
        pending: 2,
        expired: 0,
        badges: 1
    });
    assert.equal(pendingTrainings.items.length, 1);
    assert.equal(pendingTrainings.items[0].status, 'assigned');
    assert.deepEqual(pendingTrainings.pagination, {
        page: 1,
        pageSize: 1,
        total: 2,
        totalPages: 2
    });
    assert.equal(
        (await db.get('SELECT COUNT(*) AS total FROM assignments WHERE user_id = ?', [user.lastID])).total,
        3
    );

    const requests = await requestJson('/api/document-requests?page=2&pageSize=2');
    assert.equal(requests.items.length, 1);
    assert.equal(requests.items[0].answers.index, 1);
    assert.deepEqual(requests.pagination, {
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
});

test('duyuru ve haber listeleri sayfali, hedefli ve yetkilidir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-content-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const admin = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['content-admin', 'Content Admin', 'YBS', 'admin', 'active', '[]']
    );
    const employee = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['content-employee', 'Content Employee', 'Pres', 'employee', 'active', '[]']
    );
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createSession = async (userId, rawToken) => {
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
                crypto.createHash('sha256').update(rawToken).digest('hex'),
                crypto.createHash('sha256').update(`${rawToken}-csrf`).digest('hex'),
                userId,
                expiry,
                expiry
            ]
        );
    };
    await createSession(admin.lastID, 'content-admin-token');
    await createSession(employee.lastID, 'content-employee-token');

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const [title, targets, visibleUntil] of [
        ['Genel Duyuru', null, futureDate],
        ['Pres Duyurusu', JSON.stringify(['Pres']), futureDate],
        ['YBS Duyurusu', JSON.stringify(['YBS']), futureDate],
        ['Eski Duyuru', null, pastDate]
    ]) {
        await db.run(
            `INSERT INTO announcements
                (title, content, target_department, visible_until, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [title, `${title} icerigi`, targets, visibleUntil, admin.lastID]
        );
    }
    for (let index = 1; index <= 3; index += 1) {
        await db.run(
            'INSERT INTO company_news (title, content, created_by) VALUES (?, ?, ?)',
            [`Haber ${index}`, `Haber ${index} icerigi`, admin.lastID]
        );
    }

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/announcements', createAnnouncementRouter(db));
    app.use('/api/admin/announcements', createAnnouncementRouter(db));
    app.use('/api/news', createNewsRouter(db));
    app.use('/api/admin/news', createNewsRouter(db));
    const server = await listen(app);

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (url, token) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
        headers: { Cookie: `ikbenimle_session=${token}` }
    });
    const requestJson = async (url, token) => {
        const response = await request(url, token);
        assert.equal(response.status, 200);
        return response.json();
    };

    const employeeAnnouncements = await requestJson(
        '/api/announcements?page=1&pageSize=10',
        'content-employee-token'
    );
    assert.equal(employeeAnnouncements.pagination.total, 2);
    assert.deepEqual(
        employeeAnnouncements.items.map(item => item.title).sort(),
        ['Genel Duyuru', 'Pres Duyurusu']
    );
    const announcementPreview = await requestJson('/api/announcements/home-preview?pageSize=100', 'content-employee-token');
    assert.equal(announcementPreview.pagination.pageSize, 3);
    assert.deepEqual(announcementPreview.items, employeeAnnouncements.items);
    const newsPreview = await requestJson('/api/news/home-preview?pageSize=100', 'content-employee-token');
    assert.equal(newsPreview.pagination.pageSize, 6);
    assert.equal(newsPreview.items.length, 3);
    assert.equal((await request('/api/news/home-preview', 'no-session')).status, 401);
    assert.equal((await request('/api/admin/announcements/home-preview', 'content-employee-token')).status, 403);

    const adminAnnouncements = await requestJson(
        '/api/admin/announcements?page=1&pageSize=2',
        'content-admin-token'
    );
    assert.deepEqual(adminAnnouncements.pagination, {
        page: 1,
        pageSize: 2,
        total: 4,
        totalPages: 2
    });

    const employeeNews = await requestJson(
        '/api/news?page=1&pageSize=2',
        'content-employee-token'
    );
    assert.equal(employeeNews.items.length, 2);
    assert.equal(employeeNews.pagination.total, 3);
    assert.equal(
        (await request('/api/admin/news?page=1&pageSize=2', 'content-employee-token')).status,
        403
    );
    const adminNews = await requestJson(
        '/api/admin/news?page=1&pageSize=2',
        'content-admin-token'
    );
    assert.equal(adminNews.pagination.total, 3);
});

test('anket listeleri ve katilimci sonuclari sayfali ve yetkilidir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-surveys-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const admin = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['survey-admin', 'Survey Admin', 'YBS', 'admin', 'active', '[]']
    );
    const employees = [];
    for (const [employeeId, name, department] of [
        ['survey-user-1', 'Ayse Anket', 'Pres'],
        ['survey-user-2', 'Berk Anket', 'Pres'],
        ['survey-user-3', 'Cem Anket', 'YBS']
    ]) {
        const result = await db.run(
            'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
            [employeeId, name, department, 'employee', 'active', '[]']
        );
        employees.push(result.lastID);
    }

    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createSession = async (userId, rawToken) => {
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
                crypto.createHash('sha256').update(rawToken).digest('hex'),
                crypto.createHash('sha256').update(`${rawToken}-csrf`).digest('hex'),
                userId,
                expiry,
                expiry
            ]
        );
    };
    await createSession(admin.lastID, 'survey-admin-token');
    await createSession(employees[0], 'survey-employee-token');

    const surveyIds = [];
    for (const [title, status] of [
        ['Aktif Anket 1', 'active'],
        ['Aktif Anket 2', 'active'],
        ['Aktif Anket 3', 'active'],
        ['Taslak Anket', 'draft']
    ]) {
        const survey = await db.run(
            'INSERT INTO surveys (title, status, created_by) VALUES (?, ?, ?)',
            [title, status, admin.lastID]
        );
        surveyIds.push(survey.lastID);
        await db.run(
            `INSERT INTO survey_questions
                (survey_id, question_text, question_type, options, is_required, order_index)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [survey.lastID, 'Puaniniz', 'rating', '[]', 1, 0]
        );
    }
    const question = await db.get(
        'SELECT id FROM survey_questions WHERE survey_id = ?',
        [surveyIds[0]]
    );
    for (let index = 0; index < employees.length; index += 1) {
        const response = await db.run(
            'INSERT INTO survey_responses (survey_id, user_id) VALUES (?, ?)',
            [surveyIds[0], employees[index]]
        );
        await db.run(
            'INSERT INTO survey_answers (response_id, question_id, answer_value) VALUES (?, ?, ?)',
            [response.lastID, question.id, String(index + 3)]
        );
    }

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/surveys', createSurveyRouter(db));
    app.use('/api/admin/surveys', createSurveyRouter(db, 'admin'));
    const server = await listen(app);

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (url, token) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
        headers: { Cookie: `ikbenimle_session=${token}` }
    });
    const requestJson = async (url, token) => {
        const response = await request(url, token);
        assert.equal(response.status, 200);
        return response.json();
    };

    const employeePage = await requestJson(
        '/api/surveys?page=1&pageSize=2',
        'survey-employee-token'
    );
    assert.equal(employeePage.items.length, 2);
    assert.deepEqual(employeePage.pagination, {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
    assert.equal(
        (await request('/api/admin/surveys?page=1&pageSize=2', 'survey-employee-token')).status,
        403
    );

    const adminPage = await requestJson(
        '/api/admin/surveys?page=1&pageSize=2',
        'survey-admin-token'
    );
    assert.equal(adminPage.pagination.total, 4);

    const results = await requestJson(
        `/api/admin/surveys/${surveyIds[0]}/results?page=1&pageSize=1`,
        'survey-admin-token'
    );
    assert.equal(results.answers.length, 1);
    assert.equal(new Set(results.answers.map(answer => answer.response_id)).size, 1);
    assert.deepEqual(results.pagination, {
        page: 1,
        pageSize: 1,
        total: 3,
        totalPages: 3
    });
    assert.equal(results.answer_summary[String(question.id)].total, 3);
    assert.deepEqual(results.answer_summary[String(question.id)].counts, {
        3: 1,
        4: 1,
        5: 1
    });
});

test('kariyer ilanlari ve basvurular sayfali, aktiflik kontrollu ve yetkilidir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-careers-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const admin = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['career-admin', 'Career Admin', 'IK', 'admin', 'active', '[]']
    );
    const employees = [];
    for (const [employeeId, name, department] of [
        ['career-user-1', 'Ayse Kariyer', 'Pres'],
        ['career-user-2', 'Berk Kariyer', 'Pres'],
        ['career-user-3', 'Cem Kariyer', 'YBS']
    ]) {
        const result = await db.run(
            'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
            [employeeId, name, department, 'employee', 'active', '[]']
        );
        employees.push(result.lastID);
    }

    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createSession = async (userId, rawToken) => {
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
                crypto.createHash('sha256').update(rawToken).digest('hex'),
                crypto.createHash('sha256').update(`${rawToken}-csrf`).digest('hex'),
                userId,
                expiry,
                expiry
            ]
        );
    };
    await createSession(admin.lastID, 'career-admin-token');
    await createSession(employees[0], 'career-employee-token');

    const jobIds = [];
    for (const [title, status] of [
        ['Aktif Pozisyon 1', 'active'],
        ['Aktif Pozisyon 2', 'active'],
        ['Aktif Pozisyon 3', 'active'],
        ['Gizli Pasif Pozisyon', 'inactive']
    ]) {
        const result = await db.run(
            `INSERT INTO job_postings
                (title, position_type, location, status, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [title, 'Uzman', 'Bursa', status, admin.lastID]
        );
        jobIds.push(result.lastID);
    }
    for (let index = 0; index < employees.length; index += 1) {
        await db.run(
            'INSERT INTO job_applications (job_id, user_id, status) VALUES (?, ?, ?)',
            [jobIds[0], employees[index], index === 0 ? 'pending' : 'reviewing']
        );
    }

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/careers', createCareersRouter(db));
    const server = await listen(app);

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (url, token) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
        headers: { Cookie: `ikbenimle_session=${token}` }
    });
    const requestJson = async (url, token) => {
        const response = await request(url, token);
        assert.equal(response.status, 200);
        return response.json();
    };

    const employeeJobs = await requestJson(
        '/api/careers/jobs?page=1&pageSize=2',
        'career-employee-token'
    );
    assert.deepEqual(employeeJobs.pagination, {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
    assert.equal(
        (await request(`/api/careers/jobs/${jobIds[3]}`, 'career-employee-token')).status,
        404
    );

    const myApplications = await requestJson(
        '/api/careers/my-applications?page=1&pageSize=1',
        'career-employee-token'
    );
    assert.equal(myApplications.items.length, 1);
    assert.equal(myApplications.pagination.total, 1);

    assert.equal(
        (await request('/api/careers/admin/jobs?page=1&pageSize=2', 'career-employee-token')).status,
        403
    );
    const adminJobs = await requestJson(
        '/api/careers/admin/jobs?page=1&pageSize=4',
        'career-admin-token'
    );
    assert.equal(adminJobs.pagination.total, 4);
    assert.equal(
        adminJobs.items.find(item => item.id === jobIds[0]).application_count,
        3
    );

    const applications = await requestJson(
        `/api/careers/admin/jobs/${jobIds[0]}/applications?page=1&pageSize=2`,
        'career-admin-token'
    );
    assert.equal(applications.items.length, 2);
    assert.deepEqual(applications.pagination, {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
});

test('izin ve rehber listeleri sayfali, sahiplik kontrollu ve veri minimizasyonludur', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-leave-directory-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const admin = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['leave-admin', 'Leave Admin', 'IK', 'admin', 'active', '[]']
    );
    const firstEmployee = await db.run(
        'INSERT INTO users (employee_id, name, department, position, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['leave-user-1', 'Ayse Izin', 'Pres', 'Operator', 'employee', 'active', '[]']
    );
    const secondEmployee = await db.run(
        'INSERT INTO users (employee_id, name, department, position, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['leave-user-2', 'Berk Rehber', 'YBS', 'Uzman', 'employee', 'active', '[]']
    );
    const today = new Date();
    const birthDate = `1990-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await db.run(
        `INSERT INTO personal_info (user_id, phone, email, birth_date, education, skills)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [firstEmployee.lastID, '05000000001', 'ayse@example.test', birthDate, 'Lisans', 'Pres']
    );
    await db.run(
        `INSERT INTO personal_info (user_id, phone, email, birth_date, education, skills)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [secondEmployee.lastID, '05000000002', 'berk@example.test', '1991-01-02', 'Lisans', 'Network']
    );

    for (let index = 0; index < 3; index += 1) {
        await db.run(
            `INSERT INTO leave_requests (
                user_id, leave_type, requester_name, start_date, end_date,
                start_datetime, end_datetime, return_datetime,
                duration_type, duration_value, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                firstEmployee.lastID,
                'YILLIK İZİN',
                'Ayse Izin',
                '2026-08-01',
                '2026-08-01',
                `2026-08-0${index + 1}T08:00:00.000Z`,
                `2026-08-0${index + 1}T17:00:00.000Z`,
                `2026-08-0${index + 2}T08:00:00.000Z`,
                'Gün',
                1,
                'İletildi'
            ]
        );
    }
    await db.run(
        `INSERT INTO leave_requests (
            user_id, leave_type, requester_name, start_date, end_date,
            start_datetime, end_datetime, return_datetime,
            duration_type, duration_value, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            secondEmployee.lastID,
            'MAZERET',
            'Berk Rehber',
            '2026-08-05',
            '2026-08-05',
            '2026-08-05T08:00:00.000Z',
            '2026-08-05T17:00:00.000Z',
            '2026-08-06T08:00:00.000Z',
            'Gün',
            1,
            'İletildi'
        ]
    );

    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createSession = async (userId, rawToken) => {
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
                crypto.createHash('sha256').update(rawToken).digest('hex'),
                crypto.createHash('sha256').update(`${rawToken}-csrf`).digest('hex'),
                userId,
                expiry,
                expiry
            ]
        );
    };
    await createSession(admin.lastID, 'leave-admin-token');
    await createSession(firstEmployee.lastID, 'leave-employee-token');

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use(errorContractMiddleware);
    app.use('/api/leave-requests', createLeaveRouter(db));
    app.use('/api/directory', createDirectoryRouter(db));
    app.use((error, req, res, _next) => {
        if (error?.status) {
            return res.status(error.status).json({
                error: error.code,
                message: error.message,
                details: error.details,
                request_id: req.id
            });
        }
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    });
    const server = await listen(app);

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (url, token, options = {}) => fetch(
        `http://127.0.0.1:${server.address().port}${url}`,
        {
            ...options,
            headers: {
                Cookie: `ikbenimle_session=${token}`,
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers
            }
        }
    );
    const requestJson = async (url, token) => {
        const response = await request(url, token);
        assert.equal(response.status, 200);
        return response.json();
    };

    const ownRequests = await requestJson(
        '/api/leave-requests?page=1&pageSize=2',
        'leave-employee-token'
    );
    assert.deepEqual(ownRequests.pagination, {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
    assert.ok(ownRequests.items.every(item => item.user_id === firstEmployee.lastID));
    assert.equal(
        (await request('/api/leave-requests/admin?page=1&pageSize=10', 'leave-employee-token')).status,
        403
    );
    const adminRequests = await requestJson(
        '/api/leave-requests/admin?page=1&pageSize=10',
        'leave-admin-token'
    );
    assert.equal(adminRequests.pagination.total, 4);

    const directory = await requestJson(
        '/api/directory?page=1&pageSize=2',
        'leave-employee-token'
    );
    assert.equal(directory.pagination.pageSize, 2);
    assert.equal(directory.pagination.total, 3);
    assert.ok(directory.items.every(item => !('birth_date' in item)));
    assert.ok(directory.items.every(item => !('phone' in item)));

    const otherDetail = await requestJson(
        `/api/directory/${secondEmployee.lastID}`,
        'leave-employee-token'
    );
    assert.equal('phone' in otherDetail, false);
    assert.equal('personal_email' in otherDetail, false);

    const ownDetail = await requestJson(
        `/api/directory/${firstEmployee.lastID}`,
        'leave-employee-token'
    );
    assert.equal(ownDetail.phone, '05000000001');
    assert.equal(ownDetail.personal_email, 'ayse@example.test');

    const birthdays = await requestJson(
        '/api/directory/birthdays/today?page=1&pageSize=10',
        'leave-employee-token'
    );
    assert.equal(birthdays.pagination.total, 1);
    assert.equal(birthdays.items[0].id, firstEmployee.lastID);
    assert.equal('birth_date' in birthdays.items[0], false);

    const invalidCreate = await request('/api/leave-requests', 'leave-employee-token', {
        method: 'POST',
        headers: { 'x-csrf-token': 'leave-employee-token-csrf' },
        body: JSON.stringify({
            leave_type: 'YILLIK İZİN',
            start_datetime: '2026-08-10T08:00',
            end_datetime: '2026-08-10T17:00',
            return_datetime: '2026-08-11T08:00',
            duration_type: 'Gün',
            unexpected: true
        })
    });
    assert.equal(invalidCreate.status, 400);
});

test('bilgi portali ve servis hatlari sayfali, aranabilir ve yetkilidir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-knowledge-service-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const admin = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['content-admin', 'Content Admin', 'YBS', 'admin', 'active', '[]']
    );
    const employee = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['content-user', 'Content User', 'Pres', 'employee', 'active', '[]']
    );

    const categoryIds = [];
    for (const [name, orderIndex] of [
        ['Insan Kaynaklari', 0],
        ['Bilgi Islem', 1],
        ['Kalite', 2]
    ]) {
        const result = await db.run(
            'INSERT INTO knowledge_categories (name, order_index) VALUES (?, ?)',
            [name, orderIndex]
        );
        categoryIds.push(result.lastID);
    }
    await db.run(
        `INSERT INTO knowledge_items
            (category_id, sub_category, question, answer, is_featured, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [categoryIds[1], 'Hesaplar', 'Sifre nasil yenilenir?', 'Sifre ekranini acin.', 1, 0]
    );
    await db.run(
        `INSERT INTO knowledge_items
            (category_id, sub_category, question, answer, is_featured, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [categoryIds[1], 'Ag', 'VPN baglantisi', 'Bilgi Islem ile iletisime gecin.', 0, 1]
    );

    const routeIds = [];
    for (const [name, isActive] of [
        ['Gebze Hatti', 1],
        ['Darica Hatti', 1],
        ['Eski Hat', 0]
    ]) {
        const result = await db.run(
            `INSERT INTO service_routes
                (name, direction, plate, driver_name, color, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, `${name} yonu`, '41 TEST 01', 'Test Sofor', '#2563eb', isActive, admin.lastID]
        );
        routeIds.push(result.lastID);
        await db.run(
            `INSERT INTO service_route_stops
                (route_id, name, arrival_time, latitude, longitude, order_index)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [result.lastID, `${name} Durak 1`, '07:00', 40.8, 29.4, 0]
        );
        await db.run(
            `INSERT INTO service_route_stops
                (route_id, name, arrival_time, latitude, longitude, order_index)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [result.lastID, `${name} Durak 2`, '07:15', 40.81, 29.41, 1]
        );
    }

    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createSession = async (userId, rawToken) => {
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
                crypto.createHash('sha256').update(rawToken).digest('hex'),
                crypto.createHash('sha256').update(`${rawToken}-csrf`).digest('hex'),
                userId,
                expiry,
                expiry
            ]
        );
    };
    await createSession(admin.lastID, 'content-admin-token');
    await createSession(employee.lastID, 'content-employee-token');

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use(errorContractMiddleware);
    app.use('/api/knowledge', createKnowledgeRouter(db));
    app.use('/api/admin/knowledge', createKnowledgeRouter(db, 'admin'));
    app.use('/api/service-routes', createServiceRoutesRouter(db));
    app.use('/api/admin/service-routes', createServiceRoutesRouter(db, 'admin'));
    app.use((error, req, res, _next) => {
        if (error?.status) {
            return res.status(error.status).json({
                error: error.code,
                message: error.message,
                details: error.details,
                request_id: req.id
            });
        }
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    });
    const server = await listen(app);

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (url, token, options = {}) => fetch(
        `http://127.0.0.1:${server.address().port}${url}`,
        {
            ...options,
            headers: {
                Cookie: `ikbenimle_session=${token}`,
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers
            }
        }
    );
    const requestJson = async (url, token) => {
        const response = await request(url, token);
        assert.equal(response.status, 200);
        return response.json();
    };

    const categories = await requestJson(
        '/api/knowledge/categories?page=1&pageSize=2&search=Sifre',
        'content-employee-token'
    );
    assert.deepEqual(categories.pagination, {
        page: 1,
        pageSize: 2,
        total: 1,
        totalPages: 1
    });
    assert.equal(categories.items[0].name, 'Bilgi Islem');
    assert.equal(categories.items[0].matched_item_count, 1);

    const categoryItems = await requestJson(
        `/api/knowledge/categories/${categoryIds[1]}/items?page=1&pageSize=1`,
        'content-employee-token'
    );
    assert.equal(categoryItems.items.length, 1);
    assert.equal(categoryItems.pagination.total, 2);
    assert.deepEqual(categoryItems.sub_categories, ['Ag', 'Hesaplar']);
    assert.equal(
        (await request(
            '/api/admin/knowledge/categories?page=1&pageSize=10',
            'content-employee-token'
        )).status,
        403
    );

    const employeeRoutes = await requestJson(
        '/api/service-routes?page=1&pageSize=1&status=all',
        'content-employee-token'
    );
    assert.deepEqual(employeeRoutes.pagination, {
        page: 1,
        pageSize: 1,
        total: 2,
        totalPages: 2
    });
    assert.equal(employeeRoutes.items.length, 1);
    assert.equal(employeeRoutes.items[0].stops.length, 2);
    assert.ok(employeeRoutes.items[0].is_active);
    assert.equal(
        (await request(
            '/api/admin/service-routes?page=1&pageSize=10',
            'content-employee-token'
        )).status,
        403
    );

    const adminRoutes = await requestJson(
        '/api/admin/service-routes?page=1&pageSize=10&status=all',
        'content-admin-token'
    );
    assert.equal(adminRoutes.pagination.total, 3);
    assert.ok(adminRoutes.items.some(route => route.id === routeIds[2] && !route.is_active));

    const invalidRoute = await request('/api/admin/service-routes', 'content-admin-token', {
        method: 'POST',
        headers: { 'x-csrf-token': 'content-admin-token-csrf' },
        body: JSON.stringify({
            name: 'Eksik Hat',
            color: '#2563eb',
            is_active: true,
            stops: [{
                name: 'Tek Durak',
                latitude: 40.8,
                longitude: 29.4
            }]
        })
    });
    assert.equal(invalidRoute.status, 400);
});

test('bildirim rutinleri ve olay sablonlari sayfali, dogrulanmis ve yetkilidir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-notifications-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const admin = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['notification-admin', 'Notification Admin', 'YBS', 'admin', 'active', '[]']
    );
    const employee = await db.run(
        'INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
        ['notification-user', 'Notification User', 'Pres', 'employee', 'active', '[]']
    );
    for (const [title, time, active] of [
        ['Sabah Rutini', '09:00', 1],
        ['Aksam Rutini', '17:00', 1],
        ['Eski Rutin', '12:00', 0]
    ]) {
        await db.run(
            `INSERT INTO notification_routines
                (title, body, url, target, schedule_type, scheduled_time, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                `${title} mesaji`,
                '/employee/anasayfa',
                'all',
                'daily',
                time,
                active,
                admin.lastID
            ]
        );
    }

    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createSession = async (userId, rawToken) => {
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
                crypto.createHash('sha256').update(rawToken).digest('hex'),
                crypto.createHash('sha256').update(`${rawToken}-csrf`).digest('hex'),
                userId,
                expiry,
                expiry
            ]
        );
    };
    await createSession(admin.lastID, 'notification-admin-token');
    await createSession(employee.lastID, 'notification-employee-token');

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use(errorContractMiddleware);
    app.use('/api/notifications', createNotificationsRouter(db));
    app.use((error, req, res, _next) => {
        if (error?.status) {
            return res.status(error.status).json({
                error: error.code,
                message: error.message,
                details: error.details,
                request_id: req.id
            });
        }
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    });
    const server = await listen(app);

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (url, token, options = {}) => fetch(
        `http://127.0.0.1:${server.address().port}${url}`,
        {
            ...options,
            headers: {
                Cookie: `ikbenimle_session=${token}`,
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers
            }
        }
    );
    const requestJson = async (url, token) => {
        const response = await request(url, token);
        assert.equal(response.status, 200);
        return response.json();
    };

    const routineResponse = await request(
        '/api/notifications/admin/routines?page=1&pageSize=1&status=active&search=Rutin',
        'notification-admin-token'
    );
    assert.equal(routineResponse.status, 200, await routineResponse.clone().text());
    const routines = await routineResponse.json();
    assert.deepEqual(routines.pagination, {
        page: 1,
        pageSize: 1,
        total: 2,
        totalPages: 2
    });
    assert.equal(routines.items.length, 1);
    assert.equal(typeof routines.items[0].is_active, 'boolean');

    const templates = await requestJson(
        '/api/notifications/admin/event-templates?page=1&pageSize=2&search=Polivalans',
        'notification-admin-token'
    );
    assert.equal(templates.items.length, 2);
    assert.equal(templates.pagination.total, 2);

    assert.equal(
        (await request(
            '/api/notifications/admin/routines?page=1&pageSize=10',
            'notification-employee-token'
        )).status,
        403
    );

    const invalidRoutine = await request(
        '/api/notifications/admin/routines',
        'notification-admin-token',
        {
            method: 'POST',
            headers: { 'x-csrf-token': 'notification-admin-token-csrf' },
            body: JSON.stringify({
                title: 'Eksik departman',
                body: 'Test',
                url: '/employee/anasayfa',
                target: 'department',
                schedule_type: 'daily',
                scheduled_time: '27:00',
                is_active: true
            })
        }
    );
    assert.equal(invalidRoutine.status, 400);
    const invalidBody = await invalidRoutine.json();
    assert.equal(invalidBody.error, 'VALIDATION_ERROR');
});

test('polivalans denetim kayitlari tek toplu sorguyla yuklenir', async () => {
    let allCalls = 0;
    const db = {
        all: async (_sql, params) => {
            allCalls += 1;
            assert.deepEqual(params, [42, 42]);
            return [{ id: 1, entity_type: 'period' }];
        }
    };
    const repository = createPolyvalenceRepository(db);
    const rows = await repository.listAuditLogs(42);

    assert.equal(allCalls, 1);
    assert.equal(rows.length, 1);
});

test('polivalans gorev sayisi artsa da tek aggregate sorgu kullanir', async () => {
    let allCalls = 0;
    const db = {
        all: async (_sql, params) => {
            allCalls += 1;
            assert.deepEqual(params, [77]);
            return [
                { id: 1, total: 10, completed: 7, member_count: 2 },
                { id: 2, total: 50, completed: 50, member_count: 8 }
            ];
        }
    };
    const repository = createPolyvalenceRepository(db);
    const tasks = await repository.listReviewTasksForEvaluator(77);
    assert.equal(allCalls, 1);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].progress_percent, 70);
    assert.equal(tasks[1].progress_percent, 100);
});

test('uygulama ayarlari tek sorguda yuklenir ve 30 saniye cache kullanir', async () => {
    let allCalls = 0;
    let runCalls = 0;
    const db = {
        all: async (_sql, params) => {
            allCalls += 1;
            if (allCalls === 1) {
                assert.deepEqual(params, ['a', 'b']);
                return [
                    { setting_key: 'a', value: '1' },
                    { setting_key: 'b', value: '2' }
                ];
            }
            assert.deepEqual(params, ['a']);
            return [{ setting_key: 'a', value: '3' }];
        },
        run: async () => {
            runCalls += 1;
            return { changes: 1 };
        }
    };

    assert.deepEqual(await getSettings(db, ['a', 'b']), { a: '1', b: '2' });
    assert.deepEqual(await getSettings(db, ['a', 'b']), { a: '1', b: '2' });
    assert.equal(allCalls, 1);

    await setSetting(db, 'a', '3');
    assert.equal(runCalls, 1);
    await getSettings(db, ['a', 'b']);
    assert.equal(allCalls, 2);
});

test('yedek sagligi 36 saatten eski kaydi reddeder', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-health-'));
    const statusPath = path.join(tempDir, 'status.json');
    const now = 2_000_000;
    t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

    fs.writeFileSync(statusPath, JSON.stringify({
        status: 'success',
        finished_epoch: now - MAX_BACKUP_AGE_SECONDS + 1
    }));
    assert.equal((await readBackupHealth(statusPath, now)).healthy, true);

    fs.writeFileSync(statusPath, JSON.stringify({
        status: 'success',
        finished_epoch: now - MAX_BACKUP_AGE_SECONDS - 1
    }));
    assert.equal((await readBackupHealth(statusPath, now)).healthy, false);
});

test('migration status checksum ve kontrollu down akisini destekler', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-contract-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    const previousFlag = process.env.ALLOW_DESTRUCTIVE_MIGRATION;
    t.after(async () => {
        if (previousFlag === undefined) delete process.env.ALLOW_DESTRUCTIVE_MIGRATION;
        else process.env.ALLOW_DESTRUCTIVE_MIGRATION = previousFlag;
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const status = await migrationStatus(db);
    assert.ok(status.every(item => item.applied && item.checksum.length === 64));
    process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true';
    await rollbackMigrations(db, 1);
    assert.equal((await migrationStatus(db)).at(-1).applied, false);
    await runMigrations(db);
    assert.equal((await migrationStatus(db)).at(-1).applied, true);
});

test('uyumlu eski migration checksumu guvenli sekilde guncellenir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-checksum-upgrade-'));
    const databasePath = path.join(tempDir, 'database.sqlite');
    process.env.SQLITE_FILENAME = databasePath;
    const db = await setupDb();
    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    await runMigrations(db);
    await db.run(
        'UPDATE schema_migrations SET checksum = ? WHERE version = ?',
        [
            '9ce2e87ae0beb94c4f5ee76ea1a1be1d9064f6e744bda5e66cc4cffa0788478f',
            '000_initial_schema'
        ]
    );

    await runMigrations(db);
    const applied = await db.get(
        'SELECT checksum FROM schema_migrations WHERE version = ?',
        ['000_initial_schema']
    );
    assert.equal(applied.checksum, EXPECTED_MIGRATION_CHECKSUMS[0]);
});

test('veritabani baglantisi sema olusturmaz, yeni kurulum migration ile hazirlanir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-owned-schema-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();

    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const before = await db.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    );
    assert.equal(before, undefined);

    await runMigrations(db);
    const after = await db.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    );
    assert.equal(after.name, 'users');
    assert.ok(
        await db.get(
            "SELECT version FROM schema_migrations WHERE version = '000_initial_schema'"
        )
    );
});

test('eski route hatalari ortak API hata sozlesmesine donusturulur', async (t) => {
    const app = express();
    app.use((req, _res, next) => {
        req.id = 'request-test-id';
        next();
    });
    app.use(errorContractMiddleware);
    app.get('/error', (_req, res) => res.status(400).json({ error: 'Eksik alan' }));
    const server = await listen(app);
    t.after(() => server.close());

    const response = await fetch(`http://127.0.0.1:${server.address().port}/error`);
    assert.deepEqual(await response.json(), {
        error: 'BAD_REQUEST',
        message: 'Eksik alan',
        request_id: 'request-test-id'
    });
});

test('polivalans rapor hesaplari HTTP katmanindan bagimsizdir', () => {
    const dashboard = buildPolyvalenceDashboard([
        {
            period_member_id: 1,
            department_id: 10,
            department_name: 'Pres',
            employee_id_snapshot: '1001',
            employee_name_snapshot: 'Test Calisan',
            position_snapshot: 'Operator',
            role_name_snapshot: 'Operator',
            skill_name_snapshot: 'Pres kullanimi',
            category_name_snapshot: 'Teknik',
            target_level_snapshot: 2,
            level_value: 3,
            criticality_snapshot: 'critical',
            min_qualified_count_snapshot: 1
        }
    ]);

    assert.equal(dashboard.summary.polyvalence_rate, 100);
    assert.equal(dashboard.summary.total_employees, 1);
    assert.equal(dashboard.operation_risks.length, 1);
});

test('metrik endpointi kapali, hatali ve yetkili erisimleri ayirir', async (t) => {
    const previousEnabled = process.env.METRICS_ENABLED;
    const previousToken = process.env.METRICS_TOKEN;
    const app = express();
    app.use(metricsMiddleware);
    app.get('/health-test', (_req, res) => res.json({ ok: true }));
    app.get('/internal/metrics', metricsAccess, metricsHandler);
    const server = await listen(app);
    t.after(() => {
        server.close();
        if (previousEnabled === undefined) delete process.env.METRICS_ENABLED;
        else process.env.METRICS_ENABLED = previousEnabled;
        if (previousToken === undefined) delete process.env.METRICS_TOKEN;
        else process.env.METRICS_TOKEN = previousToken;
    });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/health-test`);
    assert.equal(healthResponse.status, 200);

    let metricsResponse = await fetch(`${baseUrl}/internal/metrics`);
    assert.equal(metricsResponse.status, 404);

    process.env.METRICS_ENABLED = 'true';
    process.env.METRICS_TOKEN = 'test-metrics-token-with-32-characters';
    metricsResponse = await fetch(`${baseUrl}/internal/metrics`, {
        headers: { Authorization: 'Bearer wrong-token' }
    });
    assert.equal(metricsResponse.status, 403);

    metricsResponse = await fetch(`${baseUrl}/internal/metrics`, {
        headers: { Authorization: `Bearer ${process.env.METRICS_TOKEN}` }
    });
    const body = await metricsResponse.text();
    assert.equal(metricsResponse.status, 200);
    assert.match(metricsResponse.headers.get('content-type'), /text\/plain/);
    assert.match(body, /ikbenimle_http_request_duration_seconds/);
});

test('korumali dosya handleri uretimde dosyayi nginx internal konumuna aktarir', async (t) => {
    const previousValue = process.env.X_ACCEL_REDIRECT_ENABLED;
    process.env.X_ACCEL_REDIRECT_ENABLED = 'true';
    const app = express();
    app.use('/uploads', privateFileHandler(os.tmpdir()));
    const server = await listen(app);
    t.after(() => {
        server.close();
        if (previousValue === undefined) {
            delete process.env.X_ACCEL_REDIRECT_ENABLED;
        } else {
            process.env.X_ACCEL_REDIRECT_ENABLED = previousValue;
        }
    });
    const address = server.address();

    const response = await fetch(`http://127.0.0.1:${address.port}/uploads/report.pdf`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-accel-redirect'), '/protected-files/report.pdf');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
