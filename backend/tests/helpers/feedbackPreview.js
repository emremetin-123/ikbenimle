// Isolated local UI verification server. Never mounted by the application.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'sqlite';
process.env.SEED_DEFAULT_USERS = 'false';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-preview-'));
process.env.SQLITE_FILENAME = path.join(directory, 'preview.sqlite');
const setupDb = require('../../database');
const { runMigrations } = require('../../migrations');
const { setAuthDatabase, authenticateToken } = require('../../middleware/auth');
const { createEmployeeFeedbackRouter, createAdminFeedbackRouter } = require('../../routes/feedback');

async function start() {
    const db = await setupDb();
    await runMigrations(db); setAuthDatabase(db);
    const roles = {};
    const expiry = new Date(Date.now() + 86400000).toISOString();
    for (const [role, name, department] of [['owner', 'Deneme Çalışanı', 'İnsan Kaynakları'], ['assignee', 'Deneme Sorumlusu', 'Bilgi İşlem'], ['participant', 'Deneme Katılımcısı', 'Kalite'], ['admin', 'Deneme Yöneticisi', 'İnsan Kaynakları']]) {
        const row = await db.run('INSERT INTO users (employee_id, name, department, role, status, permissions) VALUES (?, ?, ?, ?, ?, ?)',
            [`preview-${role}`, name, department, role === 'admin' ? 'admin' : 'employee', 'active', JSON.stringify(['view_feedback'])]);
        const token = crypto.randomBytes(32).toString('hex');
        const csrf = crypto.randomBytes(32).toString('hex');
        const hash = value => crypto.createHash('sha256').update(value).digest('hex');
        await db.run('INSERT INTO auth_sessions (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at) VALUES (?, ?, ?, ?, ?)', [hash(token), hash(csrf), row.lastID, expiry, expiry]);
        roles[role] = { id: row.lastID, token, csrf };
    }
    for (const [index, title, type, status] of [[1, 'Oryantasyon kontrol listesi', 'suggestion', 'in_review'], [2, 'Servis saatlerinin güncellenmesi', 'complaint', 'pending'], [3, 'Eğitim takviminin paylaşılması', 'suggestion', 'resolved']]) {
        const row = await db.run('INSERT INTO feedback (user_id, type, title, content, status, assigned_to_user_id, assigned_department, due_date, details, public_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [roles.owner.id, type, title, 'Örnek talep açıklaması. Test ortamındaki örnek bir kayıttır.', status, index === 2 ? null : roles.assignee.id, 'İnsan Kaynakları', '2026-10-30', type === 'suggestion' ? JSON.stringify({ department: 'İnsan Kaynakları', category: 'Verimlilik', currentSituation: 'Oryantasyon adımları farklı belgelerde takip ediliyor.', proposedSituation: 'Bölüm bazlı ortak bir kontrol listesi oluşturulsun.' }) : null, index === 3 ? 'Öneriniz onaylandı ve test kaydı tamamlandı.' : null]);
        for (const role of ['assignee', 'participant']) await db.run('INSERT INTO feedback_participants (feedback_id, user_id, added_by) VALUES (?, ?, ?)', [row.lastID, roles[role].id, roles.admin.id]);
        await db.run('INSERT INTO feedback_comments (feedback_id, user_id, comment, is_public) VALUES (?, ?, ?, ?)', [row.lastID, roles.admin.id, 'Talebiniz ilgili ekibe iletildi. İnceleme sonucunu burada paylaşacağız.', 1]);
        await db.run('INSERT INTO feedback_comments (feedback_id, user_id, comment, is_public) VALUES (?, ?, ?, ?)', [row.lastID, roles.admin.id, 'Yalnız ekip: Pilot kapsamı birlikte değerlendirilsin.', 0]);
        await db.run('INSERT INTO feedback_status_history (feedback_id, user_id, new_status, note) VALUES (?, ?, ?, ?)', [row.lastID, roles.admin.id, status, 'Özel geçmiş notu — çalışana görünmez.']);
    }
    const app = express();
    app.use(cors({ origin: 'http://127.0.0.1:4187', credentials: true }));
    app.use(cookieParser()); app.use(express.json());
    app.get('/preview/:role', (req, res) => {
        const session = roles[req.params.role];
        if (!session) return res.sendStatus(404);
        res.cookie('ikbenimle_session', session.token, { httpOnly: true, sameSite: 'lax' });
        res.cookie('ikbenimle_csrf', session.csrf, { sameSite: 'lax' });
        res.redirect(`http://127.0.0.1:4187/employee/${req.params.role === 'admin' ? 'moduller/geribildirim' : 'oneri-sikayet'}`);
    });
    app.get('/api/session', authenticateToken, (req, res) => res.json(req.user));
    app.post('/api/logout', (req, res) => { res.clearCookie('ikbenimle_session'); res.json({ success: true }); });
    app.use('/api/feedback', createEmployeeFeedbackRouter(db));
    app.use('/api/admin/feedback', createAdminFeedbackRouter(db));
    app.use('/api', (req, res) => res.json({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 }, count: 0 }));
    app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.code || 'PREVIEW_ERROR', message: error.message }));
    const server = app.listen(5190, '127.0.0.1', () => console.log('Isolated feedback preview: http://127.0.0.1:5190/preview/owner (also assignee, participant, admin)'));
    const close = () => { server.closeAllConnections(); server.close(async () => { await db.close(); fs.rmSync(directory, { recursive: true, force: true }); process.exit(0); }); };
    process.on('SIGINT', close); process.on('SIGTERM', close);
}
start().catch(error => { console.error(error.message); process.exit(1); });
