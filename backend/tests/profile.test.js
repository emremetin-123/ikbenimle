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
const { runMigrations } = require('../migrations');
const { setAuthDatabase } = require('../middleware/auth');
const { AppError } = require('../core/http');
const createEmployeeRouter = require('../routes/employee');
const createPersonalInfoRouter = require('../routes/personalInfo');

const listen = app => new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

test('profil guncelleme yalniz izinli alanlari kabul eder ve kullaniciya aittir', async t => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-contract-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const employee = await db.run(
        `INSERT INTO users
            (employee_id, name, department, position, role, status, permissions)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['profile-user', 'Profil Kullanıcısı', 'Pres', 'Operatör', 'employee', 'active', '[]']
    );
    const other = await db.run(
        `INSERT INTO users
            (employee_id, name, department, position, role, status, permissions)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['profile-other', 'Diğer Kullanıcı', 'YBS', 'Uzman', 'employee', 'active', '[]']
    );
    const token = 'profile-session-token';
    const csrfToken = 'profile-csrf-token';
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.run(
        `INSERT INTO auth_sessions
            (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
            crypto.createHash('sha256').update(token).digest('hex'),
            crypto.createHash('sha256').update(csrfToken).digest('hex'),
            employee.lastID,
            expiry,
            expiry
        ]
    );
    for (let index = 1; index <= 3; index += 1) {
        await db.run(
            `INSERT INTO documents (user_id, title, file_path)
             VALUES (?, ?, ?)`,
            [employee.lastID, `Belge ${index}`, `/uploads/documents/belge-${index}.pdf`]
        );
    }
    await db.run(
        `INSERT INTO documents (user_id, title, file_path)
         VALUES (?, ?, ?)`,
        [other.lastID, 'Gizli Belge', '/uploads/documents/gizli.pdf']
    );

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api', createEmployeeRouter(db));
    app.use('/api/personal-info', createPersonalInfoRouter(db));
    app.use('/api', createPersonalInfoRouter(db));
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
    const headers = {
        Cookie: `ikbenimle_session=${token}`,
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
    };

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const update = await fetch(`${baseUrl}/api/user/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            phone: '05551234567',
            address: 'Bursa',
            emergency_contact_name: 'Yakın Kişi',
            emergency_contact_phone: '05557654321',
            blood_type: 'A+',
            birth_date: '1996-05-20',
            email: 'profil@example.com',
            clothing_top: 'L',
            clothing_bottom: 'M',
            shoe_size: '42',
            education: 'Üniversite',
            hobbies: 'Kitap',
            skills: 'Excel',
            education_entries: [{
                school: 'Uludağ Üniversitesi',
                department: 'Bilgisayar Mühendisliği',
                start_year: 2014,
                end_year: 2018,
                is_current: false
            }],
            skill_tags: ['Excel', 'SQL'],
            hobby_tags: ['Kitap', 'Yürüyüş']
        })
    });
    assert.equal(update.status, 200);
    const updatedBody = await update.json();
    assert.equal(updatedBody.profile.phone, '05551234567');
    assert.equal(updatedBody.profile.birth_date, '1996-05-20');
    assert.equal(updatedBody.profile.department, 'Pres');
    assert.equal(updatedBody.profile.role, 'employee');
    assert.equal(updatedBody.profile.education_entries[0].school, 'Uludağ Üniversitesi');
    assert.deepEqual(updatedBody.profile.skill_tags, ['Excel', 'SQL']);
    assert.deepEqual(updatedBody.profile.hobby_tags, ['Kitap', 'Yürüyüş']);

    const [canonicalResponse, aliasResponse] = await Promise.all([
        fetch(`${baseUrl}/api/user/profile`, { headers: { Cookie: headers.Cookie } }),
        fetch(`${baseUrl}/api/personal-info`, { headers: { Cookie: headers.Cookie } })
    ]);
    assert.equal(canonicalResponse.status, 200);
    assert.equal(aliasResponse.status, 200);
    const canonical = await canonicalResponse.json();
    const alias = await aliasResponse.json();
    assert.equal(canonical.email, 'profil@example.com');
    assert.deepEqual(alias, canonical);
    assert.equal(Object.hasOwn(canonical, 'photo_public_id'), false);

    const documentsResponse = await fetch(
        `${baseUrl}/api/documents?page=2&pageSize=2&sort=title&order=asc`,
        { headers: { Cookie: headers.Cookie } }
    );
    assert.equal(documentsResponse.status, 200);
    const documents = await documentsResponse.json();
    assert.deepEqual(documents.pagination, {
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2
    });
    assert.equal(documents.items.length, 1);
    assert.equal(documents.items[0].title, 'Belge 3');
    assert.equal(documents.items.some(document => document.title === 'Gizli Belge'), false);

    const privilegeAttempt = await fetch(`${baseUrl}/api/user/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            role: 'admin',
            department: 'Yönetim',
            user_id: other.lastID
        })
    });
    assert.equal(privilegeAttempt.status, 400);
    assert.equal((await privilegeAttempt.json()).error, 'VALIDATION_ERROR');

    const invalidPhone = await fetch(`${baseUrl}/api/user/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ phone: '123' })
    });
    assert.equal(invalidPhone.status, 400);
    assert.equal((await invalidPhone.json()).error, 'VALIDATION_ERROR');

    const users = await db.all(
        'SELECT id, role, department FROM users WHERE id IN (?, ?) ORDER BY id',
        [employee.lastID, other.lastID]
    );
    assert.deepEqual(users.map(user => [user.role, user.department]), [
        ['employee', 'Pres'],
        ['employee', 'YBS']
    ]);
});
