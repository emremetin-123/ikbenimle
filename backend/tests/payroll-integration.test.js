const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const PDFDocument = require('pdfkit');

const postgresUrl = process.env.PAYROLL_TEST_POSTGRES_URL;
process.env.DB_TYPE = postgresUrl ? 'postgres' : 'sqlite';
if (postgresUrl) {
    process.env.DATABASE_URL = postgresUrl;
    process.env.DB_SSL = 'false';
}
process.env.NODE_ENV = 'test';
process.env.SEED_DEFAULT_USERS = 'false';

const setupDb = require('../database');
const { runMigrations, migrationStatus, rollbackMigrations } = require('../migrations');
const createMachineRoutes = require('../modules/integrations/machineIntegrationRoutes');
const createDocumentRoutes = require('../modules/personalInfo/documentRoutes');
const { createAdminIntegrationRepository } = require('../modules/integrations/adminIntegrationRepository');
const { createAdminIntegrationService } = require('../modules/integrations/adminIntegrationService');
const { createIntegrationRepository } = require('../modules/integrations/integrationRepository');
const { createPayrollStorage } = require('../modules/integrations/payrollStorage');
const { authenticateToken, setAuthDatabase } = require('../middleware/auth');
const { authorizeUpload } = require('../middleware/uploadAccess');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const pdf = text => new Promise(resolve => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.text(text); doc.end();
});

test('ERP simulation uploads, revises and privately serves payrolls without duplicate records', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'payroll-api-'));
    process.env.SQLITE_FILENAME = path.join(directory, 'test.sqlite');
    const db = await setupDb();
    t.after(async () => { await db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    await runMigrations(db);
    const migrations = await migrationStatus(db);
    const payrollIndex = migrations.findIndex(item => item.version === '025_payroll_integration');
    assert.ok(payrollIndex >= 0);
    process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true';
    try { await rollbackMigrations(db, migrations.length - payrollIndex); } finally { delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; }
    await runMigrations(db);
    setAuthDatabase(db);
    const admin = await db.run("INSERT INTO users (employee_id, name, role, status, permissions) VALUES ('test-admin', 'Test Admin', 'admin', 'active', '[]')");
    const service = createAdminIntegrationService(createAdminIntegrationRepository(db), createIntegrationRepository(db));
    const connection = await service.createConnection({ name: 'Deneme ERP', provider: 'generic_bridge', is_enabled: true,
        employee_sync_enabled: true, leave_balance_sync_enabled: true, leave_request_export_enabled: true,
        leave_export_trigger: 'approved' }, { id: admin.lastID });
    const key = await service.createApiKey(connection.id, { name: 'Deneme', scopes: ['employees:write', 'leave-balances:write', 'payrolls:write'] }, { id: admin.lastID });
    const limited = await service.createApiKey(connection.id, { name: 'Sınırlı', scopes: ['employees:write'] }, { id: admin.lastID });
    let failStore = false;
    const storage = {
        async store(file) {
            if (failStore) throw new Error('TEST_STORAGE_FAILURE');
            const filename = crypto.randomUUID() + '.pdf';
            await fs.promises.writeFile(path.join(directory, filename), file.buffer);
            return { filePath: '/uploads/documents/' + filename, provider: 'local', storageKey: filename };
        },
        async remove(stored) { await fs.promises.unlink(path.join(directory, stored.storageKey)); }
    };
    const app = express();
    app.use(express.json()); app.use(cookieParser());
    app.use('/api/integrations/v1', createMachineRoutes(db, { storage }));
    app.use('/api', createDocumentRoutes(db));
    app.use('/uploads', authenticateToken, authorizeUpload(db));
    app.use('/uploads/documents', express.static(directory));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.code || 'INTERNAL_SERVER_ERROR' }));
    const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { Authorization: `Bearer ${key.token}`, 'Content-Type': 'application/json' };
    const post = (route, body, operation) => fetch(base + '/api/integrations/v1/' + route, {
        method: 'POST', headers: { ...headers, 'Idempotency-Key': operation }, body: JSON.stringify(body)
    });
    const employeeBody = { employees: [{ external_employee_id: 'erp-person-1', employee_id: 'person-1', name: 'Deneme Calisani', department: 'Uretim' }] };
    assert.equal((await post('employees/upsert', employeeBody, 'employee-operation-0001')).status, 200);
    assert.equal((await post('employees/upsert', employeeBody, 'employee-operation-0001')).headers.get('x-idempotent-replay'), 'true');
    const user = await db.get("SELECT id FROM users WHERE employee_id = 'person-1'");
    assert.equal((await post('leave-balances/upsert', { balances: [{ external_employee_id: 'erp-person-1', balance_days: 14.5, as_of_date: '2026-11-01' }] }, 'balance-operation-0001')).status, 200);
    assert.equal((await db.get('SELECT balance_days FROM integration_leave_balances WHERE user_id = ?', [user.id])).balance_days, 14.5);
    const original = await pdf('Example payroll - no real employee data');
    const revised = await pdf('Example payroll revision 2');
    const upload = (overrides = {}, token = key.token, bytes = original, filename = 'payroll.pdf', mime = 'application/pdf') => {
        const body = new FormData();
        for (const [name, value] of Object.entries({ external_employee_id: 'erp-person-1', external_payroll_id: 'payroll-1', period: '2026-11', revision: '1', ...overrides })) body.set(name, value);
        if (bytes !== null) body.set('file', new Blob([bytes], { type: mime }), filename);
        return fetch(base + '/api/integrations/v1/payrolls/upsert', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
    };
    assert.equal((await upload({}, 'invalid')).status, 401);
    assert.equal((await upload({}, limited.token)).status, 403);
    assert.equal((await upload({ external_employee_id: 'unknown' })).status, 409);
    assert.equal((await upload({ period: '2026-13' })).status, 400);
    assert.equal((await upload({ user_id: String(admin.lastID) })).status, 400);
    assert.equal((await upload({}, key.token, null)).status, 400);
    assert.equal((await upload({}, key.token, Buffer.from('This is not a PDF file'))).status, 400);
    assert.equal((await upload({}, key.token, original, 'payroll.exe')).status, 400);
    assert.equal((await upload({}, key.token, original, 'payroll.pdf', 'image/png')).status, 400);
    assert.equal((await upload({}, key.token, Buffer.alloc(20 * 1024 * 1024 + 1))).status, 413);
    const sent = await Promise.all([upload(), upload()]);
    assert.deepEqual(sent.map(response => response.status), [200, 200]);
    const results = await Promise.all(sent.map(response => response.json()));
    assert.equal(results[0].document_id, results[1].document_id);
    assert.equal(results.filter(result => result.replayed).length, 1);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS count FROM documents')).count), 1);
    assert.equal((await upload({}, key.token, revised)).status, 409);
    assert.equal((await upload({ external_payroll_id: 'different-id' })).status, 409);
    assert.equal((await upload({ period: '2026-10', revision: '2' })).status, 409);

    const session = async (id, label) => {
        const expiry = new Date(Date.now() + 3600000).toISOString();
        await db.run(`INSERT INTO auth_sessions (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
            VALUES (?, ?, ?, ?, ?)`, [hash(label), hash(label + '-csrf'), id, expiry, expiry]);
        return { Cookie: `ikbenimle_session=${label}` };
    };
    const ownHeaders = await session(user.id, 'payroll-owner');
    const other = await db.run("INSERT INTO users (employee_id, name, role, status, permissions) VALUES ('other', 'Other Employee', 'employee', 'active', '[]')");
    const otherHeaders = await session(other.lastID, 'payroll-other');
    const list = await (await fetch(base + '/api/documents', { headers: ownHeaders })).json();
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].title, '2026-11 Bordrosu');
    const oldPath = list.items[0].file_path;
    assert.equal((await fetch(base + oldPath)).status, 401);
    assert.equal((await fetch(base + oldPath, { headers: otherHeaders })).status, 403);
    const download = await fetch(base + oldPath, { headers: ownHeaders });
    assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), original);
    assert.equal((await (await fetch(base + '/api/documents', { headers: otherHeaders })).json()).items.length, 0);

    failStore = true;
    assert.equal((await upload({ revision: '2' }, key.token, revised)).status, 500);
    assert.equal((await db.get('SELECT revision FROM integration_payrolls')).revision, 1);
    failStore = false;
    // Audit failure occurs after file creation and must roll back the document and remove the staged file.
    await db.exec(postgresUrl ? `
        CREATE FUNCTION reject_payroll_audit_fn() RETURNS trigger AS $$
        BEGIN
            IF NEW.action = 'payrolls.upsert' THEN RAISE EXCEPTION 'test audit failure'; END IF;
            RETURN NEW;
        END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_payroll_audit BEFORE INSERT ON integration_audit_events
        FOR EACH ROW EXECUTE FUNCTION reject_payroll_audit_fn();
    ` : "CREATE TRIGGER reject_payroll_audit BEFORE INSERT ON integration_audit_events WHEN NEW.action = 'payrolls.upsert' BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
    const filesBefore = fs.readdirSync(directory).filter(name => name.endsWith('.pdf'));
    assert.equal((await upload({ revision: '2' }, key.token, revised)).status, 500);
    assert.deepEqual(fs.readdirSync(directory).filter(name => name.endsWith('.pdf')), filesBefore);
    assert.equal((await db.get('SELECT revision FROM integration_payrolls')).revision, 1);
    await db.exec(postgresUrl
        ? 'DROP TRIGGER reject_payroll_audit ON integration_audit_events; DROP FUNCTION reject_payroll_audit_fn();'
        : 'DROP TRIGGER reject_payroll_audit;');
    const corrected = await upload({ revision: '2' }, key.token, revised);
    assert.equal(corrected.status, 200);
    assert.equal((await corrected.json()).document_id, results[0].document_id);
    assert.equal((await upload()).status, 409);
    assert.equal((await upload({ revision: '2' }, key.token, revised)).headers.get('x-idempotent-replay'), 'true');
    assert.equal(Number((await db.get('SELECT COUNT(*) AS count FROM documents')).count), 1);
    const updated = await db.get('SELECT file_path FROM documents');
    assert.equal(fs.existsSync(path.join(directory, path.basename(oldPath))), false);
    const updatedDownload = await fetch(base + updated.file_path, { headers: ownHeaders });
    assert.deepEqual(Buffer.from(await updatedDownload.arrayBuffer()), revised);
    assert.equal(Number((await db.get("SELECT COUNT(*) AS count FROM integration_audit_events WHERE action = 'payrolls.upsert'")).count), 2);
    assert.ok((await service.listConnections())[0].last_success_at);
    await db.run('UPDATE integration_connections SET is_enabled = 0 WHERE id = ?', [connection.id]);
    assert.equal((await upload()).status, 401);
});

test('payroll storage produces protected local paths and removes stored files', async () => {
    const storage = createPayrollStorage();
    const bytes = await pdf('Storage test');
    const stored = await storage.store({ buffer: bytes });
    try {
        assert.equal(stored.provider, 'local');
        assert.match(stored.filePath, /^\/uploads\/documents\/payroll-[a-f0-9-]+\.pdf$/);
        assert.deepEqual(fs.readFileSync(path.resolve(__dirname, '..', stored.filePath.slice(1))), bytes);
    } finally { await storage.remove(stored); }
    assert.equal(fs.existsSync(path.resolve(__dirname, '..', stored.filePath.slice(1))), false);
});
