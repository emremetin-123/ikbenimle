const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.DB_TYPE = 'sqlite';
process.env.SEED_DEFAULT_USERS = 'false';
process.env.NODE_ENV = 'test';

const express = require('express');
const cookieParser = require('cookie-parser');
const setupDb = require('../database');
const { runMigrations } = require('../migrations');
const polyvalenceRoutes = require('../routes/polyvalence');
const { setAuthDatabase } = require('../middleware/auth');
const { createAuditMiddleware } = require('../modules/audit/auditMiddleware');

test('polivalans dönem, klonlama, arşiv ve kilitleme kuralları', { timeout: 20000 }, async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'polyvalence-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    t.diagnostic('Veritabanı hazır');
    setAuthDatabase(db);

    const adminResult = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions, session_version) VALUES (?, ?, ?, ?, ?, ?)',
        ['admin-test', 'Test Yönetici', 'admin', 'active', JSON.stringify(['manage_polyvalence']), 0]
    );
    const managerResult = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions, session_version) VALUES (?, ?, ?, ?, ?, ?)',
        ['manager-test', 'Test Amir', 'employee', 'active', '[]', 0]
    );
    const alternateManagerResult = await db.run(
        'INSERT INTO users (employee_id, name, role, status, permissions, session_version) VALUES (?, ?, ?, ?, ?, ?)',
        ['alternate-manager-test', 'Alternatif Amir', 'employee', 'active', '[]', 0]
    );
    const employeeResult = await db.run(
        'INSERT INTO users (employee_id, name, department, position, manager_id, role, status, permissions, session_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['employee-test', 'Test Çalışan', 'Üretim', 'Operatör', managerResult.lastID, 'employee', 'active', '[]', 0]
    );

    const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
    const sessionFor = async (userId, name) => {
        const token = `${name}-session-token`;
        const csrf = `${name}-csrf-token`;
        const absoluteExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await db.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [hash(token), hash(csrf), userId, absoluteExpiry, absoluteExpiry]
        );
        return { token, csrf };
    };
    const adminToken = await sessionFor(adminResult.lastID, 'admin');
    const managerToken = await sessionFor(managerResult.lastID, 'manager');
    const alternateManagerToken = await sessionFor(alternateManagerResult.lastID, 'alternate-manager');

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    const journal = createAuditMiddleware(db);
    app.use(journal.middleware);
    app.use('/api/polyvalence', polyvalenceRoutes(db));
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    t.diagnostic('Test API hazır');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await journal.drain();
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const request = async (method, endpoint, session, body) => {
        const response = await fetch(`${baseUrl}${endpoint}`, {
            method,
            headers: {
                Cookie: `ikbenimle_session=${session.token}; ikbenimle_csrf=${session.csrf}`,
                'X-CSRF-Token': session.csrf,
                'Content-Type': 'application/json'
            },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await response.text();
        await journal.drain();
        return { status: response.status, data: text && response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text || {} };
    };

    const department = await request('POST', '/api/polyvalence/admin/departments', adminToken, { name: 'Üretim', source_department_name: 'Üretim' });
    t.diagnostic('Ana tanımlar oluşturuluyor');
    assert.equal(department.status, 200);
    const role = await request('POST', '/api/polyvalence/admin/roles', adminToken, { department_id: department.data.id, name: 'Operatör' });
    const category = await request('POST', '/api/polyvalence/admin/categories', adminToken, { department_id: department.data.id, name: 'Makine' });
    const skillA = await request('POST', '/api/polyvalence/admin/skills', adminToken, { department_id: department.data.id, category_id: category.data.id, name: 'Pres Kullanımı' });
    const skillB = await request('POST', '/api/polyvalence/admin/skills', adminToken, { department_id: department.data.id, category_id: category.data.id, name: 'Kalite Kontrolü' });
    await request('PUT', '/api/polyvalence/admin/targets', adminToken, { skill_id: skillA.data.id, role_id: role.data.id, target_level: 3, criticality: 'critical', min_qualified_count: 2 });
    await request('PUT', '/api/polyvalence/admin/targets', adminToken, { skill_id: skillB.data.id, role_id: role.data.id, target_level: 2, criticality: 'normal', min_qualified_count: 1 });
    const firstPeriod = await request('POST', '/api/polyvalence/admin/periods', adminToken, {
        department_id: department.data.id,
        name: '2026 İlk Dönem',
        start_date: '2026-01-01',
        end_date: '2026-03-31',
        due_date: '2026-03-15'
    });
    const opened = await request('POST', `/api/polyvalence/admin/periods/${firstPeriod.data.id}/open`, adminToken, {});
    t.diagnostic('İlk dönem açıldı');
    assert.equal(opened.status, 200);
    assert.equal(opened.data.skill_count, 2);
    const automaticMembership = await db.get(
        'SELECT * FROM polyvalence_memberships WHERE user_id = ?',
        [employeeResult.lastID]
    );
    assert.equal(automaticMembership.evaluator_user_id, managerResult.lastID);
    assert.equal(automaticMembership.is_manual_override, 0);

    const manualMembership = await request('PUT', '/api/polyvalence/admin/memberships', adminToken, {
        user_id: employeeResult.lastID,
        department_id: department.data.id,
        role_id: role.data.id,
        evaluator_user_id: alternateManagerResult.lastID
    });
    assert.equal(manualMembership.status, 200);
    assert.equal(manualMembership.data.is_manual_override, 1);
    const resetMembership = await request(
        'DELETE',
        `/api/polyvalence/admin/memberships/${automaticMembership.id}/override`,
        adminToken
    );
    assert.equal(resetMembership.status, 200);
    assert.equal(resetMembership.data.evaluator_user_id, managerResult.lastID);
    assert.equal(resetMembership.data.is_manual_override, 0);

    const removedMembership = await request('PUT', '/api/polyvalence/admin/memberships', adminToken, {
        user_id: employeeResult.lastID,
        department_id: department.data.id,
        role_id: role.data.id,
        evaluator_user_id: managerResult.lastID,
        is_active: false
    });
    assert.equal(removedMembership.status, 200);
    assert.equal(removedMembership.data.is_active, 0);
    assert.equal(removedMembership.data.is_manual_override, 1);
    await request('GET', '/api/polyvalence/admin/setup?resource=memberships&page=1&pageSize=25', adminToken);
    const stillRemoved = await db.get('SELECT is_active FROM polyvalence_memberships WHERE user_id = ?', [employeeResult.lastID]);
    assert.equal(stillRemoved.is_active, 0);
    const restoredMembership = await request('PUT', '/api/polyvalence/admin/memberships', adminToken, {
        user_id: employeeResult.lastID,
        department_id: department.data.id,
        role_id: role.data.id,
        evaluator_user_id: managerResult.lastID,
        is_active: true
    });
    assert.equal(restoredMembership.status, 200);
    assert.equal(restoredMembership.data.is_active, 1);

    const tasks = await request('GET', '/api/polyvalence/my-tasks', managerToken);
    assert.equal(tasks.data.length, 1);
    const auditCount = (await db.get("SELECT COUNT(*) AS n FROM application_audit_events WHERE module = 'polyvalence'")).n;
    const navSummary = await request('GET', '/api/polyvalence/my-tasks/summary', managerToken);
    assert.equal(navSummary.status, 200);
    assert.deepEqual(navSummary.data, { has_tasks: true });
    assert.deepEqual((await request('GET', '/api/polyvalence/my-tasks/summary', alternateManagerToken)).data, { has_tasks: false });
    assert.equal((await db.get("SELECT COUNT(*) AS n FROM application_audit_events WHERE module = 'polyvalence'")).n, auditCount);
    const taskId = tasks.data[0].id;
    const task = await request('GET', `/api/polyvalence/tasks/${taskId}`, managerToken);
    assert.equal(task.data.members[0].assessments.length, 2);
    assert.equal(task.data.levels.length, 4);
    assert.deepEqual(task.data.levels.map(level => level.level_value), [0, 1, 2, 3]);
    assert.equal((await request('GET', `/api/polyvalence/tasks/${taskId}`, alternateManagerToken)).status, 403);
    assert.equal((await request('GET', '/api/polyvalence/my-tasks', alternateManagerToken)).data.length, 0);
    assert.equal((await request('PUT', `/api/polyvalence/tasks/${taskId}/assessments/${task.data.members[0].assessments[0].id}`, alternateManagerToken, {
        level: 3, can_train: false, note: '', version_no: 0
    })).status, 403);

    for (const assessment of task.data.members[0].assessments) {
        const saved = await request('PUT', `/api/polyvalence/tasks/${taskId}/assessments/${assessment.id}`, managerToken, {
            level: 3,
            can_train: assessment.skill_id === skillA.data.id,
            note: assessment.skill_id === skillA.data.id ? 'Eğitim verebilir gözlemi doğrulandı.' : '',
            version_no: assessment.version_no
        });
        assert.equal(saved.status, 200);
    }
    const assessmentLog = await db.get("SELECT details FROM application_audit_events WHERE module = 'polyvalence' AND action = 'update' AND outcome = 'success' AND resource_id = ? ORDER BY created_at DESC LIMIT 1", [taskId + '/' + task.data.members[0].assessments[0].id]);
    assert.equal(JSON.parse(assessmentLog.details).level_value, 3);
    assert.equal(JSON.parse(assessmentLog.details).before.level_value, null);
    assert.doesNotMatch(assessmentLog.details, /Eğitim verebilir gözlemi/);
    assert.equal((await request('POST', `/api/polyvalence/tasks/${taskId}/complete`, managerToken, {})).status, 200);
    assert.equal((await request('POST', `/api/polyvalence/admin/periods/${firstPeriod.data.id}/close`, adminToken, {})).status, 200);
    t.diagnostic('İlk dönem kapatıldı');

    const locked = await request('PUT', `/api/polyvalence/tasks/${taskId}/assessments/${task.data.members[0].assessments[0].id}`, managerToken, {
        level: 2, can_train: false, note: 'Düşürüldü', version_no: 1
    });
    assert.equal(locked.status, 409);

    await request('POST', `/api/polyvalence/admin/skills/${skillB.data.id}/archive`, adminToken, { archived: true, reason: 'Yeni dönemde kullanılmayacak' });
    const secondPeriod = await request('POST', '/api/polyvalence/admin/periods', adminToken, {
        department_id: department.data.id,
        name: '2026 İkinci Dönem',
        start_date: '2026-04-01',
        end_date: '2026-06-30',
        due_date: '2026-06-15'
    });
    assert.equal((await request('POST', `/api/polyvalence/admin/periods/${secondPeriod.data.id}/open`, adminToken, {})).status, 200);
    t.diagnostic('İkinci dönem açıldı');
    const secondTasks = await request('GET', '/api/polyvalence/my-tasks', managerToken);
    const secondTask = await request('GET', `/api/polyvalence/tasks/${secondTasks.data[0].id}`, managerToken);
    assert.equal(secondTask.data.members[0].assessments.length, 1);
    assert.equal(secondTask.data.members[0].assessments[0].skill_id, skillA.data.id);
    assert.equal(secondTask.data.members[0].assessments[0].level, 3);
    assert.equal(secondTask.data.members[0].assessments[0].can_train, true);

    const invalidTrainer = await request('PUT', `/api/polyvalence/tasks/${secondTask.data.id}/assessments/${secondTask.data.members[0].assessments[0].id}`, managerToken, {
        level: 2, can_train: true, note: 'Geçersiz deneme', version_no: secondTask.data.members[0].assessments[0].version_no
    });
    assert.equal(invalidTrainer.status, 400);

    const reportGroups = await request('GET', '/api/polyvalence/admin/report-period-groups', adminToken);
    assert.equal(reportGroups.status, 200);
    assert.ok(reportGroups.data.length >= 2);
    const secondGroup = reportGroups.data.find(item => item.start_date === '2026-04-01' && item.end_date === '2026-06-30');
    assert.ok(secondGroup);

    const dashboard = await request('GET', `/api/polyvalence/admin/report-dashboard?group_key=${secondGroup.key}&department_id=all`, adminToken);
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.data.summary.polyvalence_rate, 100);
    assert.equal(dashboard.data.summary.completion_percent, 100);
    assert.equal(dashboard.data.summary.critical_risk_count, 1);
    assert.equal(dashboard.data.operation_risks.length, 1);
    assert.equal(dashboard.data.department_comparison[0].score, 100);

    const skillC = await request('POST', '/api/polyvalence/admin/skills', adminToken, { department_id: department.data.id, category_id: category.data.id, name: 'Yeni Hedef Beceri' });
    await request('PUT', '/api/polyvalence/admin/targets', adminToken, { skill_id: skillC.data.id, role_id: role.data.id, target_level: 1, criticality: 'normal', min_qualified_count: 1 });
    const gaps = await request('GET', '/api/polyvalence/admin/open-period-gaps', adminToken);
    assert.equal(gaps.status, 200);
    assert.equal(gaps.data.some(item => item.period_id === secondPeriod.data.id && item.missing_assessments === 1), true);
    const synced = await request('POST', `/api/polyvalence/admin/periods/${secondPeriod.data.id}/sync-open`, adminToken, {});
    assert.equal(synced.status, 200);
    assert.equal(synced.data.added_assessments, 1);
    const syncedTask = await request('GET', `/api/polyvalence/tasks/${secondTask.data.id}`, managerToken);
    assert.equal(syncedTask.data.members[0].assessments.length, 2);

    const historicalSkill = await db.get(
        'SELECT skill_name_snapshot FROM polyvalence_period_skills WHERE period_id = ? AND skill_id = ?',
        [firstPeriod.data.id, skillB.data.id]
    );
    assert.equal(historicalSkill.skill_name_snapshot, 'Kalite Kontrolü');

    // Report permission grants only the evaluator's current department, even
    // when another department's identifiers are supplied directly.
    await db.run('UPDATE users SET department = ?, permissions = ? WHERE id = ?',
        ['Üretim', JSON.stringify(['view_polyvalence_reports']), managerResult.lastID]);
    const foreignDepartment = await request('POST', '/api/polyvalence/admin/departments', adminToken, { name: 'Bakım' });
    const foreignPeriod = await request('POST', '/api/polyvalence/admin/periods', adminToken, {
        department_id: foreignDepartment.data.id, name: 'Başka Atölye',
        start_date: '2026-01-01', end_date: '2026-06-30', due_date: '2026-06-30'
    });
    assert.equal(foreignPeriod.status, 200);
    const visiblePeriods = await request('GET', '/api/polyvalence/admin/periods', managerToken);
    assert.equal(visiblePeriods.status, 200);
    assert.equal(visiblePeriods.data.every(period => period.department_id === department.data.id), true);
    const ownReport = await request('GET', `/api/polyvalence/admin/periods/${secondPeriod.data.id}/report`, managerToken);
    assert.equal(ownReport.status, 200, JSON.stringify(ownReport.data));
    for (const suffix of ['report', 'export.csv', 'audit']) {
        assert.equal((await request('GET', `/api/polyvalence/admin/periods/${foreignPeriod.data.id}/${suffix}`, managerToken)).status, 403, suffix);
        assert.equal((await request('GET', `/api/polyvalence/admin/periods/${foreignPeriod.data.id}/${suffix}`, adminToken)).status, 200);
    }
    assert.equal((await request('GET', `/api/polyvalence/admin/report-dashboard?period_id=${foreignPeriod.data.id}`, managerToken)).status, 404);
    assert.equal((await request('GET', '/api/polyvalence/admin/setup?includeLarge=false', managerToken)).status, 403);
});
