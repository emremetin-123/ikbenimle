// Isolated local simulator. Never imported or mounted by the application server.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

process.env.DB_TYPE = 'sqlite';
process.env.NODE_ENV = 'test';
process.env.SEED_DEFAULT_USERS = 'false';

async function start() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-preview-'));
    process.env.SQLITE_FILENAME = path.join(directory, 'preview.sqlite');
    const db = await require('../../database')();
    await require('../../migrations').runMigrations(db);
    const { authenticateToken, setAuthDatabase } = require('../../middleware/auth');
    setAuthDatabase(db);
    const users = {};
    for (const role of ['owner', 'other']) {
        const result = await db.run(`INSERT INTO users (employee_id, name, department, role, status, permissions)
            VALUES (?, ?, ?, ?, ?, ?)`, [role, 'Deneme ' + role, 'Uretim', 'employee', 'active', '["view_documents"]']);
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000).toISOString();
        await db.run(`INSERT INTO auth_sessions (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
            VALUES (?, ?, ?, ?, ?)`, [crypto.createHash('sha256').update(token).digest('hex'),
            crypto.createHash('sha256').update('test-csrf').digest('hex'), result.lastID, expiry, expiry]);
        users[role] = token;
    }
    const connection = await db.run(`INSERT INTO integration_connections
        (name, provider, is_enabled, employee_sync_enabled) VALUES ('Deneme ERP', 'generic_bridge', 1, 1)`);
    const token = crypto.randomBytes(32).toString('hex');
    await db.run(`INSERT INTO integration_api_keys (connection_id, name, key_prefix, token_hash, scopes_json)
        VALUES (?, ?, ?, ?, ?)`, [connection.lastID, 'Local simulator', 'preview',
        crypto.createHash('sha256').update(token).digest('hex'), '["employees:write","payrolls:write"]']);
    const storage = {
        async store(file) {
            const filename = crypto.randomUUID() + '.pdf';
            await fs.promises.writeFile(path.join(directory, filename), file.buffer);
            return { filePath: '/uploads/documents/' + filename, provider: 'local', storageKey: filename };
        },
        remove: stored => fs.promises.unlink(path.join(directory, stored.storageKey))
    };
    const app = express();
    app.use(cors({ origin: 'http://127.0.0.1:4188', credentials: true }));
    app.use(cookieParser()); app.use(express.json());
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/preview/fixture', (_req, res) => res.json({ api_key: token }));
    app.get('/preview/login/:role', (req, res) => {
        if (!users[req.params.role]) return res.sendStatus(404);
        res.cookie('ikbenimle_session', users[req.params.role], { httpOnly: true, sameSite: 'lax' });
        res.redirect('http://127.0.0.1:4188/employee/belgelerim');
    });
    app.get('/api/session', authenticateToken, (req, res) => res.json(req.user));
    app.use('/api/integrations/v1', require('../../modules/integrations/machineIntegrationRoutes')(db, { storage }));
    app.use('/api', require('../../modules/personalInfo/documentRoutes')(db));
    app.use('/uploads', authenticateToken, require('../../middleware/uploadAccess').authorizeUpload(db));
    app.use('/uploads/documents', express.static(directory));
    app.use('/api', (_req, res) => res.json({ items: [], count: 0, pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } }));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code || 'PREVIEW_ERROR', message: error.message }));
    const server = app.listen(5191, '127.0.0.1');
    const close = () => {
        server.closeAllConnections();
        server.close(async () => { await db.close(); fs.rmSync(directory, { recursive: true, force: true }); process.exit(0); });
    };
    process.on('SIGINT', close); process.on('SIGTERM', close);
}
start().catch(error => { console.error(error); process.exit(1); });
