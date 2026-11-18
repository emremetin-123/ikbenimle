const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

process.env.DB_TYPE = 'sqlite';
process.env.SEED_DEFAULT_USERS = 'false';
process.env.NODE_ENV = 'test';

const setupDb = require('../database');
const { MIGRATIONS, runMigrations } = require('../migrations');
const authRoutes = require('../routes/auth');
const adminRoutes = require('../routes/admin');
const { authorizeUpload } = require('../middleware/uploadAccess');
const {
    assertLoginAllowed,
    recordLoginFailure,
    clearLoginGuard,
    clearAccountLoginGuard,
    constants: { MAX_FAILURES }
} = require('../services/loginGuardService');
const {
    authenticateToken,
    isAdmin,
    requirePermission,
    setAuthDatabase
} = require('../middleware/auth');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('login kilidi uygulama yeniden baslasa da veritabaninda kalir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'login-guard-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    const req = { ip: '192.0.2.10', socket: {} };

    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    let guard = await assertLoginAllowed(db, req, 'guarded-user');
    assert.equal(guard.allowed, true);
    for (let attempt = 0; attempt < MAX_FAILURES; attempt += 1) {
        await recordLoginFailure(db, guard.keys);
    }

    guard = await assertLoginAllowed(db, req, 'guarded-user');
    assert.equal(guard.allowed, false);
    await clearLoginGuard(db, guard.keys);
    assert.equal((await assertLoginAllowed(db, req, 'guarded-user')).allowed, true);
});

test('login failure artisi tek atomic upsert kullanir ve basarili hesap IP kaydini silmez', async () => {
    const statements = [];
    const fakeDb = {
        transaction: work => work({
            run: async (sql, params) => statements.push({ sql, params }),
            get: async () => { throw new Error('read-modify-write kullanilmamali'); }
        })
    };
    const keys = { account: 'account-key', ip: 'ip-key' };
    await recordLoginFailure(fakeDb, keys);
    assert.equal(statements.length, 2);
    assert.ok(statements.every(item => item.sql.includes('ON CONFLICT(key_hash) DO UPDATE')));

    const deletes = [];
    await clearAccountLoginGuard({
        run: async (sql, params) => deletes.push({ sql, params })
    }, keys);
    assert.deepEqual(deletes[0].params, ['account-key']);
    assert.doesNotMatch(deletes[0].sql, /IN\s*\(/);
});

test('oturum, CSRF ve modül yetkileri birbirinden ayrıdır', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const user = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)',
        ['limited-user', 'Limited User', 'employee', 'active', JSON.stringify(['manage_announcements'])]
    );
    const token = 'limited-session-token';
    const csrf = 'limited-csrf-token';
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
    app.get('/admin-only', authenticateToken, isAdmin, (_req, res) => res.json({ ok: true }));
    app.get('/announcement-admin', authenticateToken, requirePermission('manage_announcements'), (_req, res) => res.json({ ok: true }));
    app.get('/user-admin', authenticateToken, requirePermission('manage_users'), (_req, res) => res.json({ ok: true }));
    app.post('/announcement-admin', authenticateToken, requirePermission('manage_announcements'), (_req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const cookie = `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = (endpoint, options = {}) => fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: { Cookie: cookie, ...(options.headers || {}) }
    });

    assert.equal((await request('/admin-only')).status, 403);
    assert.equal((await request('/announcement-admin')).status, 200);
    assert.equal((await request('/user-admin')).status, 403);
    assert.equal((await request('/announcement-admin', { method: 'POST' })).status, 403);
    assert.equal((await request('/announcement-admin', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf }
    })).status, 200);
    assert.equal((await fetch(`${baseUrl}/announcement-admin?token=${token}`)).status, 401);
});

test('login cookie oturumu olusturur ve yeni login onceki oturumu iptal eder', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'login-session-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    await db.run(
        `INSERT INTO users
            (employee_id, name, role, status, permissions, password_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['secure-user', 'Secure User', 'employee', 'active', '[]', await bcrypt.hash('StrongPassword123!', 10)]
    );

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api', authRoutes(db));
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const login = () => fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: 'secure-user', password: 'StrongPassword123!' })
    });
    const cookieHeader = (response) => {
        const values = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
        return values.map(value => value.split(';')[0]).filter(Boolean).join('; ');
    };

    const firstLogin = await login();
    assert.equal(firstLogin.status, 200);
    const firstPayload = await firstLogin.clone().json();
    assert.equal(firstPayload.session_policy.idle_timeout_ms, 30 * 60 * 1000);
    assert.equal(firstPayload.session_policy.warning_duration_ms, 30 * 1000);
    assert.ok(firstPayload.session_policy.idle_expires_at);
    assert.ok(firstPayload.session_policy.absolute_expires_at);
    const firstCookie = cookieHeader(firstLogin);
    assert.match(firstCookie, /ikbenimle_session=/);
    assert.match(firstCookie, /ikbenimle_csrf=/);
    assert.equal((await fetch(`${baseUrl}/api/session`, { headers: { Cookie: firstCookie } })).status, 200);

    const secondLogin = await login();
    assert.equal(secondLogin.status, 200);
    const secondCookie = cookieHeader(secondLogin);
    assert.notEqual(firstCookie, secondCookie);
    assert.equal((await fetch(`${baseUrl}/api/session`, { headers: { Cookie: firstCookie } })).status, 401);

    const sessionToken = /ikbenimle_session=([^;]+)/.exec(secondCookie)?.[1];
    assert.ok(sessionToken);
    await db.run(
        `UPDATE auth_sessions
         SET last_seen_at = ?, idle_expires_at = ?
         WHERE token_hash = ?`,
        [
            new Date(Date.now() - 2 * 60 * 1000),
            new Date(Date.now() + 10 * 1000),
            hash(sessionToken)
        ]
    );
    const activeSession = await fetch(`${baseUrl}/api/session`, { headers: { Cookie: secondCookie } });
    assert.equal(activeSession.status, 200);
    assert.equal((await activeSession.json()).session_policy.idle_timeout_ms, 30 * 60 * 1000);
    const touchedSession = await db.get(
        'SELECT idle_expires_at FROM auth_sessions WHERE token_hash = ?',
        [hash(sessionToken)]
    );
    assert.ok(new Date(touchedSession.idle_expires_at).getTime() > Date.now() + 25 * 60 * 1000);

    const csrfToken = /ikbenimle_csrf=([^;]+)/.exec(secondCookie)?.[1];
    assert.ok(csrfToken);
    const logout = await fetch(`${baseUrl}/api/logout`, {
        method: 'POST',
        headers: {
            Cookie: secondCookie,
            'X-CSRF-Token': csrfToken
        }
    });
    assert.equal(logout.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/session`, { headers: { Cookie: secondCookie } })).status, 401);
    const activeCount = await db.get(
        'SELECT COUNT(*) AS total FROM auth_sessions WHERE revoked_at IS NULL'
    );
    assert.equal(Number(activeCount.total), 0);
});

test('kullanici yoneticisi kendisine veya baskasina admin yetkisi veremez', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privilege-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const manager = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)',
        ['user-manager', 'User Manager', 'employee', 'active', JSON.stringify(['manage_users'])]
    );
    const token = 'user-manager-session';
    const csrf = 'user-manager-csrf';
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.run(
        `INSERT INTO auth_sessions
            (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [hash(token), hash(csrf), manager.lastID, expiry, expiry]
    );

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/admin', adminRoutes(db));
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const response = await fetch(`${baseUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
            Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`,
            'X-CSRF-Token': csrf,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            employee_id: 'new-admin',
            name: 'Unauthorized Admin',
            department: 'IT',
            position: 'Specialist',
            status: 'active',
            permissions: ['manage_users'],
            password: 'StrongPassword123!',
            role: 'admin'
        })
    });

    assert.equal(response.status, 403);
    assert.equal(await db.get('SELECT id FROM users WHERE employee_id = ?', ['new-admin']), undefined);
});

test('bolumu olmayan mevcut yoneticinin parolasi diger alanlari bozmadan degistirilebilir', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-admin-password-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const currentPassword = 'CurrentPassword123!';
    const nextPassword = 'UpdatedPassword123!';
    const admin = await db.run(
        `INSERT INTO users
            (employee_id, name, department, role, status, permissions, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['legacy-admin', 'Legacy Admin', null, 'admin', 'active', '[]', await bcrypt.hash(currentPassword, 10)]
    );
    const token = 'legacy-admin-session';
    const csrf = 'legacy-admin-csrf';
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.run(
        `INSERT INTO auth_sessions
            (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [hash(token), hash(csrf), admin.lastID, expiry, expiry]
    );

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/admin', adminRoutes(db));
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const response = await fetch(`${baseUrl}/api/admin/users/${admin.lastID}`, {
        method: 'PUT',
        headers: {
            Cookie: `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`,
            'X-CSRF-Token': csrf,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            employee_id: 'legacy-admin',
            name: 'Legacy Admin',
            department: '',
            position: '',
            manager_id: '',
            status: 'active',
            permissions: [],
            password: nextPassword,
            role: 'admin',
            phone: '',
            address: '',
            emergency_contact_name: '',
            emergency_contact_phone: '',
            blood_type: '',
            birth_date: '',
            email: '',
            clothing_top: '',
            clothing_bottom: '',
            shoe_size: ''
        })
    });

    assert.equal(response.status, 200);
    const updated = await db.get(
        'SELECT department, password_hash FROM users WHERE id = ?',
        [admin.lastID]
    );
    assert.equal(updated.department, null);
    assert.equal(await bcrypt.compare(nextPassword, updated.password_hash), true);
});

test('hassas yuklemeler nesne sahipligi olmadan indirilemez', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-access-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const owner = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)',
        ['file-owner', 'File Owner', 'employee', 'active', '[]']
    );
    const intruder = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)',
        ['file-intruder', 'File Intruder', 'employee', 'active', '[]']
    );
    await db.run(
        'INSERT INTO documents (user_id, title, file_path) VALUES (?, ?, ?)',
        [owner.lastID, 'Payroll', '/uploads/documents/payroll.pdf']
    );
    const video = await db.run(
        'INSERT INTO videos (title, cover_image_url) VALUES (?, ?)',
        ['Assigned training', '/uploads/videos/training-cover.jpg']
    );
    await db.run(
        'INSERT INTO assignments (user_id, video_id, status) VALUES (?, ?, ?)',
        [owner.lastID, video.lastID, 'assigned']
    );

    const createSession = async (userId, label) => {
        const token = `${label}-token`;
        const csrf = `${label}-csrf`;
        const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [hash(token), hash(csrf), userId, expiry, expiry]
        );
        return `ikbenimle_session=${token}; ikbenimle_csrf=${csrf}`;
    };
    const ownerCookie = await createSession(owner.lastID, 'owner');
    const intruderCookie = await createSession(intruder.lastID, 'intruder');

    const app = express();
    app.use(cookieParser());
    app.use(
        '/uploads',
        authenticateToken,
        authorizeUpload(db),
        (_req, res) => res.sendStatus(204)
    );
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/uploads/documents/payroll.pdf`;
    const coverUrl = `http://127.0.0.1:${server.address().port}/uploads/videos/training-cover.jpg`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    assert.equal((await fetch(url, { headers: { Cookie: ownerCookie } })).status, 204);
    assert.equal((await fetch(url, { headers: { Cookie: intruderCookie } })).status, 403);
    assert.equal((await fetch(coverUrl, { headers: { Cookie: ownerCookie } })).status, 204);
    assert.equal((await fetch(coverUrl, { headers: { Cookie: intruderCookie } })).status, 403);
});

test('legacy secret environmenta tasinmadan migration veriyi silmez', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-migration-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    delete process.env.GEMINI_API_KEY;
    const db = await setupDb();
    await MIGRATIONS.find(migration => migration.version === '000_initial_schema')
        .up(db, 'sqlite');
    await db.run(
        'INSERT INTO app_settings (setting_key, value) VALUES (?, ?)',
        ['gemini_api_key', 'legacy-secret-value']
    );

    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    await assert.rejects(
        runMigrations(db),
        /SECURE_SECRET_MIGRATION_REQUIRED: set GEMINI_API_KEY/
    );
    const preserved = await db.get(
        'SELECT value FROM app_settings WHERE setting_key = ?',
        ['gemini_api_key']
    );
    assert.equal(preserved.value, 'legacy-secret-value');
});
