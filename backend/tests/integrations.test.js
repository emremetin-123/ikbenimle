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
const createAdminRouter = require('../routes/admin');
const createMachineIntegrationRoutes = require('../modules/integrations/machineIntegrationRoutes');
const createLeaveRouter = require('../routes/leave');
const { setAuthDatabase } = require('../middleware/auth');
const { AppError } = require('../core/http');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');

const createSession = async (db, userId, label) => {
    const token = `${label}-session-token`;
    const csrf = `${label}-csrf-token`;
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.run(`
        INSERT INTO auth_sessions (
            token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at
        ) VALUES (?, ?, ?, ?, ?)
    `, [hash(token), hash(csrf), userId, expiry, expiry]);
    return { token, csrf };
};

const listen = app => new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

test('ERP koprusu guvenli anahtar, idempotency, bakiye ve izin outbox sozlesmesini korur', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integration-gateway-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);

    const admin = await db.run(`
        INSERT INTO users (employee_id, name, department, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
    `, ['admin-erp', 'ERP Admin', 'YBS', 'admin', 'active', '[]']);
    const employee = await db.run(`
        INSERT INTO users (employee_id, name, department, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
    `, ['employee-existing', 'Mevcut Calisan', 'Pres', 'employee', 'active', '[]']);
    const adminSession = await createSession(db, admin.lastID, 'integration-admin');
    const employeeSession = await createSession(db, employee.lastID, 'integration-employee');

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/admin', createAdminRouter(db));
    app.use('/api/integrations/v1', createMachineIntegrationRoutes(db));
    app.use('/api/leave-requests', createLeaveRouter(db));
    app.use((error, req, res, _next) => {
        if (error instanceof AppError) {
            return res.status(error.status).json({ error: error.code, message: error.message, request_id: req.id });
        }
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    });
    const server = await listen(app);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const adminHeaders = {
        'Content-Type': 'application/json',
        Cookie: `ikbenimle_session=${adminSession.token}; ikbenimle_csrf=${adminSession.csrf}`,
        'X-CSRF-Token': adminSession.csrf
    };
    const connectionResponse = await fetch(`${baseUrl}/api/admin/integrations`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
            name: 'Logo Test',
            provider: 'logo_bridge',
            is_enabled: true,
            employee_sync_enabled: true,
            leave_balance_sync_enabled: true,
            leave_request_export_enabled: true,
            leave_export_trigger: 'created'
        })
    });
    assert.equal(connectionResponse.status, 201);
    const connection = await connectionResponse.json();

    const keyResponse = await fetch(`${baseUrl}/api/admin/integrations/${connection.id}/api-keys`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
            name: 'Test Koprusu',
            scopes: [
                'employees:write',
                'leave-balances:write',
                'leave-requests:read',
                'leave-requests:ack'
            ],
            ip_allowlist: [],
            expires_at: null
        })
    });
    assert.equal(keyResponse.status, 201);
    const apiKey = await keyResponse.json();
    assert.match(apiKey.token, /^ikp_/);

    const keyListResponse = await fetch(`${baseUrl}/api/admin/integrations/${connection.id}/api-keys`, {
        headers: { Cookie: `ikbenimle_session=${adminSession.token}` }
    });
    const keyList = await keyListResponse.json();
    assert.equal(keyList.items[0].token, undefined);
    assert.equal(keyList.items[0].token_hash, undefined);

    const unauthorizedAdminResponse = await fetch(`${baseUrl}/api/admin/integrations`, {
        headers: { Cookie: `ikbenimle_session=${employeeSession.token}` }
    });
    assert.equal(unauthorizedAdminResponse.status, 403);

    const limitedKeyResponse = await fetch(`${baseUrl}/api/admin/integrations/${connection.id}/api-keys`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
            name: 'Sinirli Test Koprusu',
            scopes: ['leave-balances:write'],
            ip_allowlist: [],
            expires_at: null
        })
    });
    assert.equal(limitedKeyResponse.status, 201);
    const limitedKey = await limitedKeyResponse.json();
    const missingScopeResponse = await fetch(`${baseUrl}/api/integrations/v1/employees/upsert`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${limitedKey.token}`,
            'Idempotency-Key': ['missing', 'employee', 'scope', '0001'].join('-')
        },
        body: JSON.stringify({
            employees: [{
                external_employee_id: 'scope-test',
                employee_id: 'scope-test',
                name: 'Kapsam Testi',
                department: 'YBS'
            }]
        })
    });
    assert.equal(missingScopeResponse.status, 403);

    const ipRestrictedKeyResponse = await fetch(`${baseUrl}/api/admin/integrations/${connection.id}/api-keys`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
            name: 'IP Test Koprusu',
            scopes: ['employees:write'],
            ip_allowlist: ['203.0.113.10'],
            expires_at: null
        })
    });
    assert.equal(ipRestrictedKeyResponse.status, 201);
    const ipRestrictedKey = await ipRestrictedKeyResponse.json();
    const deniedIpResponse = await fetch(`${baseUrl}/api/integrations/v1/status`, {
        headers: { Authorization: `Bearer ${ipRestrictedKey.token}` }
    });
    assert.equal(deniedIpResponse.status, 403);

    const machineHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.token}`
    };
    const invalidTokenResponse = await fetch(`${baseUrl}/api/integrations/v1/status`, {
        headers: { Authorization: 'Bearer invalid-token' }
    });
    assert.equal(invalidTokenResponse.status, 401);

    const forbiddenFieldResponse = await fetch(`${baseUrl}/api/integrations/v1/employees/upsert`, {
        method: 'POST',
        headers: { ...machineHeaders, 'Idempotency-Key': 'forbidden-role-field-0001' },
        body: JSON.stringify({
            employees: [{
                external_employee_id: 'forbidden-admin',
                employee_id: 'forbidden-admin',
                name: 'Yetki Denemesi',
                department: 'YBS',
                role: 'admin'
            }]
        })
    });
    assert.equal(forbiddenFieldResponse.status, 400);

    const privilegedTargetResponse = await fetch(`${baseUrl}/api/integrations/v1/employees/upsert`, {
        method: 'POST',
        headers: { ...machineHeaders, 'Idempotency-Key': 'privileged-target-sync-0001' },
        body: JSON.stringify({
            employees: [{
                external_employee_id: 'logo-admin',
                employee_id: 'admin-erp',
                name: 'Degistirilmis Admin',
                department: 'Pres'
            }]
        })
    });
    assert.equal(privilegedTargetResponse.status, 409);
    assert.equal((await db.get('SELECT name FROM users WHERE id = ?', [admin.lastID])).name, 'ERP Admin');

    const idempotencyKey = 'employee-sync-2026-08-20-0001';
    const employeePayload = {
        employees: [{
            external_employee_id: 'logo-1001',
            employee_id: '1001',
            name: 'Logo Calisani',
            department: 'Pres',
            position: 'Operator',
            manager_employee_id: null,
            status: 'active',
            email: 'logo@example.test',
            source_updated_at: '2026-08-20T08:00:00Z'
        }]
    };
    const syncResponse = await fetch(`${baseUrl}/api/integrations/v1/employees/upsert`, {
        method: 'POST',
        headers: { ...machineHeaders, 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(employeePayload)
    });
    assert.equal(syncResponse.status, 200);
    const syncResult = await syncResponse.json();
    assert.equal(syncResult.summary.created, 1);
    assert.equal(syncResult.summary.activation_required, 1);

    const replayResponse = await fetch(`${baseUrl}/api/integrations/v1/employees/upsert`, {
        method: 'POST',
        headers: { ...machineHeaders, 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(employeePayload)
    });
    assert.equal(replayResponse.headers.get('x-idempotent-replay'), 'true');
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM users WHERE employee_id = ?', ['1001'])).count, 1);
    const syncedUser = await db.get('SELECT * FROM users WHERE employee_id = ?', ['1001']);
    assert.equal(syncedUser.role, 'employee');
    assert.equal(syncedUser.password_hash, null);
    assert.doesNotMatch(syncedUser.permissions, /manage_/);

    const balanceResponse = await fetch(`${baseUrl}/api/integrations/v1/leave-balances/upsert`, {
        method: 'POST',
        headers: { ...machineHeaders, 'Idempotency-Key': 'balance-sync-2026-08-20-0001' },
        body: JSON.stringify({
            balances: [{
                external_employee_id: 'logo-1001',
                balance_days: 12.5,
                as_of_date: '2026-08-20',
                source_updated_at: '2026-08-20T08:05:00Z'
            }]
        })
    });
    assert.equal(balanceResponse.status, 200);
    assert.equal((await db.get(
        'SELECT balance_days FROM integration_leave_balances WHERE user_id = ?',
        [syncedUser.id]
    )).balance_days, 12.5);

    const leaveResponse = await fetch(`${baseUrl}/api/leave-requests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `ikbenimle_session=${employeeSession.token}; ikbenimle_csrf=${employeeSession.csrf}`,
            'X-CSRF-Token': employeeSession.csrf
        },
        body: JSON.stringify({
            leave_type: 'YILLIK İZİN',
            start_datetime: '2026-09-01T08:00:00.000Z',
            end_datetime: '2026-09-02T17:00:00.000Z',
            return_datetime: '2026-09-03T08:00:00.000Z',
            duration_type: 'Gün',
            description: 'Test izin talebi'
        })
    });
    assert.equal(leaveResponse.status, 201);
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM integration_outbox')).count, 1);

    const claimResponse = await fetch(`${baseUrl}/api/integrations/v1/leave-requests?limit=10`, {
        headers: { Authorization: `Bearer ${apiKey.token}` }
    });
    assert.equal(claimResponse.status, 200);
    const claimed = await claimResponse.json();
    assert.equal(claimed.items.length, 1);
    assert.equal(claimed.items[0].payload.employee_id, 'employee-existing');

    await db.run(
        "UPDATE integration_outbox SET locked_until = '2000-01-01 00:00:00' WHERE id = ?",
        [claimed.items[0].id]
    );
    const expiredLeaseAckResponse = await fetch(`${baseUrl}/api/integrations/v1/leave-requests/${claimed.items[0].id}/ack`, {
        method: 'POST',
        headers: machineHeaders,
        body: JSON.stringify({ status: 'succeeded', external_reference: 'EXPIRED-LEASE' })
    });
    assert.equal(expiredLeaseAckResponse.status, 409);

    const reclaimedResponse = await fetch(`${baseUrl}/api/integrations/v1/leave-requests?limit=10`, {
        headers: { Authorization: `Bearer ${apiKey.token}` }
    });
    assert.equal(reclaimedResponse.status, 200);
    const reclaimed = await reclaimedResponse.json();
    assert.equal(reclaimed.items.length, 1);

    const failedDelivery = await fetch(baseUrl + '/api/integrations/v1/leave-requests/' + reclaimed.items[0].id + '/ack', {
        method: 'POST', headers: machineHeaders,
        body: JSON.stringify({ status: 'failed', error_code: 'ERP_OFFLINE', error_message: 'Test ERP temporarily offline', retry_after_seconds: 30 })
    });
    assert.equal(failedDelivery.status, 200);
    assert.equal((await db.get('SELECT status FROM integration_outbox WHERE id = ?', [reclaimed.items[0].id])).status, 'retry');
    await db.run("UPDATE integration_outbox SET available_at = '2000-01-01 00:00:00' WHERE id = ?", [reclaimed.items[0].id]);
    const retryClaim = await fetch(baseUrl + '/api/integrations/v1/leave-requests?limit=10', {
        headers: { Authorization: 'Bearer ' + apiKey.token }
    });
    assert.equal(retryClaim.status, 200);
    assert.equal((await retryClaim.json()).items[0].id, reclaimed.items[0].id);

    const ackResponse = await fetch(`${baseUrl}/api/integrations/v1/leave-requests/${reclaimed.items[0].id}/ack`, {
        method: 'POST',
        headers: machineHeaders,
        body: JSON.stringify({ status: 'succeeded', external_reference: 'LOGO-LEAVE-1' })
    });
    assert.equal(ackResponse.status, 200);
    const outbox = await db.get('SELECT status, external_reference FROM integration_outbox WHERE id = ?', [reclaimed.items[0].id]);
    assert.equal(outbox.status, 'completed');
    assert.equal(outbox.external_reference, 'LOGO-LEAVE-1');
});
