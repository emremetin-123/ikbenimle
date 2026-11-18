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
const { createEmployeeFeedbackRouter, createAdminFeedbackRouter } = require('../routes/feedback');
const { removeCommentAttachment } = require('../modules/feedback/feedbackAttachments');

test('feedback workflow protects visibility, progress, closure and role-scoped review', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-workflow-'));
    process.env.SQLITE_FILENAME = path.join(directory, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    setAuthDatabase(db);
    const hash = value => crypto.createHash('sha256').update(value).digest('hex');
    const ids = {};
    for (const name of ['owner', 'assignee', 'participant', 'outsider', 'admin']) {
        const row = await db.run('INSERT INTO users (employee_id, name, role, status, permissions) VALUES (?, ?, ?, ?, ?)',
            [`workflow-${name}`, name, 'employee', 'active', JSON.stringify(name === 'admin' ? ['manage_feedback'] : [])]);
        ids[name] = row.lastID;
        const expiry = new Date(Date.now() + 3600000).toISOString();
        await db.run(`INSERT INTO auth_sessions (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at)
            VALUES (?, ?, ?, ?, ?)`, [hash(name), hash(`${name}-csrf`), row.lastID, expiry, expiry]);
    }
    const app = express();
    app.use(cookieParser()); app.use(express.json());
    app.use('/api/feedback', createEmployeeFeedbackRouter(db));
    app.use('/api/admin/feedback', createAdminFeedbackRouter(db));
    app.use((error, req, res, next) => { res.status(error.status || 500).json({ error: error.code, message: error.message }); });
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        await db.close(); fs.rmSync(directory, { recursive: true, force: true });
    });
    const request = (url, name = 'admin', method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
        method, headers: {
            Cookie: `ikbenimle_session=${name}; ikbenimle_csrf=${name}-csrf`,
            'X-CSRF-Token': `${name}-csrf`,
            ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body instanceof FormData ? body : JSON.stringify(body),
    });
    const create = async (status = 'pending') => (await db.run('INSERT INTO feedback (user_id, type, title, content, status) VALUES (?, ?, ?, ?, ?)',
        [ids.owner, 'suggestion', 'Oryantasyon', 'Kontrol listesi', status])).lastID;
    const assignment = { assigned_to_user_id: ids.assignee, assigned_department: 'İK', participant_user_ids: [ids.participant] };
    const adminUrl = id => `/api/admin/feedback/${id}`;
    const employeeUrl = id => `/api/feedback/${id}`;

    await t.test('assignment edits preserve progress and validate active users', async () => {
        const id = await create();
        assert.equal((await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment)).status, 200);
        assert.equal((await db.get('SELECT status FROM feedback WHERE id = ?', [id])).status, 'assigned');
        assert.equal((await request(`${employeeUrl(id)}/comments`, 'assignee', 'POST', { comment: 'İncelemeye başladım.' })).status, 200);
        assert.equal((await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', { ...assignment, note: 'PRIVATE ASSIGNMENT NOTE' })).status, 200);
        assert.equal((await db.get('SELECT status FROM feedback WHERE id = ?', [id])).status, 'in_review');
        const last = await db.get('SELECT old_status, new_status FROM feedback_status_history WHERE feedback_id = ? ORDER BY id DESC LIMIT 1', [id]);
        assert.deepEqual(last, { old_status: 'in_review', new_status: 'in_review' });
        assert.equal((await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', { ...assignment, participant_user_ids: [999999] })).status, 400);
        assert.equal((await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', {})).status, 400);
        const participants = await db.all('SELECT user_id FROM feedback_participants WHERE feedback_id = ?', [id]);
        assert.deepEqual(participants.map(row => row.user_id).sort(), [ids.assignee, ids.participant].sort());
    });

    await t.test('only an assignment and subsequent review activity advance the open workflow', async () => {
        const id = await create();
        const admin = adminUrl(id);
        const employee = employeeUrl(id);
        const status = async () => (await (await request(`${employee}/detail`, 'owner')).json()).display_status;
        assert.equal(await status(), 'pending');
        assert.equal((await request(`${employee}/comments`, 'owner', 'POST', { comment: 'Atamadan önce ek bilgi' })).status, 200);
        assert.equal(await status(), 'pending');
        assert.equal((await request(`${admin}/status`, 'admin', 'PUT', { status: 'in_review' })).status, 409);
        assert.equal((await request(`${admin}/assignment`, 'admin', 'PUT', { ...assignment, note: 'Atama notu' })).status, 200);
        assert.equal(await status(), 'assigned');
        assert.equal((await request(`${employee}/participants`, 'assignee', 'POST', { user_ids: [ids.participant] })).status, 200);
        assert.equal(await status(), 'assigned');
        const results = await Promise.all([
            request(`${employee}/comments`, 'owner', 'POST', { comment: 'Atamadan sonra ek bilgi' }),
            request(`${admin}/comments`, 'admin', 'POST', { comment: 'İnceleme başladı' }),
        ]);
        assert.deepEqual(results.map(result => result.status), [200, 200]);
        assert.equal(await status(), 'in_review');
        const transitions = await db.all("SELECT old_status, new_status FROM feedback_status_history WHERE feedback_id = ? AND new_status = 'in_review'", [id]);
        assert.deepEqual(transitions, [{ old_status: 'assigned', new_status: 'in_review' }]);
        assert.equal((await request(`${admin}/status`, 'admin', 'PUT', { status: 'resolved' })).status, 409);
    });

    await t.test('owner sees public messages only; team can choose internal or public', async () => {
        const id = await create();
        await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment);
        for (const [name, isPublic, comment] of [['admin', false, 'TEAM SECRET'], ['participant', false, 'TEAM OPINION'], ['participant', true, 'PUBLIC OPINION'], ['owner', false, 'OWNER REPLY']]) {
            const prefix = name === 'admin' ? adminUrl(id) : employeeUrl(id);
            assert.equal((await request(`${prefix}/comments`, name, 'POST', { comment, is_public: isPublic })).status, 200);
        }
        const owner = await (await request(`${employeeUrl(id)}/thread`, 'owner')).json();
        assert.deepEqual(owner.comments.map(c => c.comment), ['PUBLIC OPINION', 'OWNER REPLY']);
        const team = await (await request(`${employeeUrl(id)}/thread`, 'assignee')).json();
        assert.equal(team.comments.length, 4);
        const detail = await (await request(`${employeeUrl(id)}/detail`, 'assignee')).json();
        assert.equal(detail.viewer_role, 'assignee'); assert.equal(detail.can_internal_comment, true);
        const ownerDetail = await (await request(`${employeeUrl(id)}/detail`, 'owner')).json();
        assert.equal(ownerDetail.can_internal_comment, false);
        assert.equal((await request(`${employeeUrl(id)}/thread`, 'outsider')).status, 403);
        assert.equal((await request(`${employeeUrl(id)}/comments`, 'outsider', 'POST', { comment: 'Unrelated' })).status, 403);
    });

    await t.test('the current assignee can add active participants only to their own open request', async () => {
        const id = await create();
        await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment);
        const optionsUrl = `${employeeUrl(id)}/participant-options`;
        const inviteUrl = `${employeeUrl(id)}/participants`;
        const invite = { user_ids: [ids.outsider] };
        for (const name of ['owner', 'participant', 'outsider', 'admin']) {
            assert.equal((await request(optionsUrl, name)).status, 403);
            assert.equal((await request(inviteUrl, name, 'POST', invite)).status, 403);
        }
        assert.equal((await (await request(`${employeeUrl(id)}/detail`, 'assignee')).json()).can_add_participants, true);
        const options = await (await request(`${optionsUrl}?search=outsider&pageSize=1`, 'assignee')).json();
        assert.deepEqual(options.items, [{ id: ids.outsider, name: 'outsider', employee_id: 'workflow-outsider', department: null }]);
        const available = await (await request(optionsUrl, 'assignee')).json();
        assert.deepEqual(available.items.map(row => row.id).sort(), [ids.admin, ids.outsider].sort());
        assert.equal((await request(inviteUrl, 'assignee', 'POST', { user_ids: [ids.outsider, 999999] })).status, 400);
        assert.equal((await request(`${employeeUrl(id)}/thread`, 'outsider')).status, 403);
        const added = await Promise.all([1, 2].map(() => request(inviteUrl, 'assignee', 'POST', invite)));
        assert.deepEqual(added.map(response => response.status), [200, 200]);
        assert.equal((await (await request(`${employeeUrl(id)}/detail`, 'assignee')).json()).display_status, 'in_review');
        assert.deepEqual(await db.all("SELECT old_status FROM feedback_status_history WHERE feedback_id = ? AND new_status = 'in_review'", [id]),
            [{ old_status: 'assigned' }]);
        const participant = await db.all('SELECT added_by FROM feedback_participants WHERE feedback_id = ? AND user_id = ?', [id, ids.outsider]);
        assert.deepEqual(participant, [{ added_by: ids.assignee }]);
        assert.equal((await request(`${employeeUrl(id)}/thread`, 'outsider')).status, 200);
        assert.equal((await request(inviteUrl, 'outsider', 'POST', { user_ids: [ids.admin] })).status, 403);
        const remaining = await (await request(optionsUrl, 'assignee')).json();
        assert.deepEqual(remaining.items.map(row => row.id), [ids.admin]);
        await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', { ...assignment, assigned_to_user_id: ids.participant });
        assert.equal((await request(inviteUrl, 'assignee', 'POST', invite)).status, 403);
        await request(`${adminUrl(id)}/decision`, 'admin', 'PUT', { status: 'resolved', decision: 'approved', public_response: 'Onaylandı.' });
        assert.equal((await request(optionsUrl, 'participant')).status, 409);
        assert.equal((await request(inviteUrl, 'participant', 'POST', invite)).status, 409);
    });

    await t.test('comment attachment downloads enforce request membership and the visibility of the comment', async subtest => {
        const id = await create();
        const otherId = await create();
        await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment);
        const bytes = Buffer.from('%PDF-1.7\n%%EOF\n');
        const form = (name = 'Şablon.pdf', contents = bytes, type = 'application/pdf') => {
            const data = new FormData();
            data.set('comment', name);
            data.set('is_public', 'false');
            data.set('file', new Blob([contents], { type }), name);
            return data;
        };
        subtest.after(async () => {
            const files = await db.all('SELECT attachment_key FROM feedback_comments WHERE feedback_id = ? AND attachment_key IS NOT NULL', [id]);
            await Promise.all(files.map(row => removeCommentAttachment(row.attachment_key)));
        });
        const commentUrl = `${employeeUrl(id)}/comments`;
        assert.equal((await request(commentUrl, 'outsider', 'POST', form())).status, 403);
        assert.equal((await request(commentUrl, 'assignee', 'POST', form('Sahte.pdf', Buffer.from('fake image content')))).status, 400);
        assert.equal((await request(commentUrl, 'assignee', 'POST', form('Yanlış.pdf', bytes, 'image/png'))).status, 400);
        assert.equal((await request(commentUrl, 'assignee', 'POST', form('Büyük.pdf', Buffer.alloc(10 * 1024 * 1024 + 1)))).status, 400);
        const twoFiles = form();
        twoFiles.append('file', new Blob([bytes], { type: 'application/pdf' }), 'ikinci.pdf');
        assert.equal((await request(commentUrl, 'assignee', 'POST', twoFiles)).status, 400);
        assert.equal((await request(commentUrl, 'assignee', 'POST', form())).status, 200);
        assert.equal((await request(commentUrl, 'owner', 'POST', form('Yanıt.pdf'))).status, 200);
        const maxSizePdf = Buffer.alloc(10 * 1024 * 1024);
        bytes.copy(maxSizePdf);
        assert.equal((await request(`${adminUrl(id)}/comments`, 'admin', 'POST', form('Yönetici.pdf', maxSizePdf))).status, 200);
        const team = await (await request(`${employeeUrl(id)}/thread`, 'participant')).json();
        assert.deepEqual(team.comments.map(comment => comment.attachment_name), ['Şablon.pdf', 'Yanıt.pdf', 'Yönetici.pdf']);
        assert.ok(team.comments.every(comment => !Object.hasOwn(comment, 'attachment_key')));
        const owner = await (await request(`${employeeUrl(id)}/thread`, 'owner')).json();
        assert.deepEqual(owner.comments.map(comment => comment.attachment_name), ['Yanıt.pdf']);
        const internalPath = `/comments/${team.comments[0].id}/attachment`;
        assert.equal((await request(employeeUrl(id) + internalPath, 'owner')).status, 404);
        assert.equal((await request(employeeUrl(id) + internalPath, 'outsider')).status, 403);
        assert.equal((await request(employeeUrl(otherId) + internalPath, 'owner')).status, 404);
        assert.equal((await request(adminUrl(id) + internalPath, 'participant')).status, 403);
        const download = await request(adminUrl(id) + internalPath, 'admin');
        assert.equal(download.status, 200);
        assert.equal(download.headers.get('cache-control'), 'private, no-store');
        assert.match(download.headers.get('content-disposition'), /attachment;.*filename\*=UTF-8''%C5%9Eablon\.pdf/);
        assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
        await request(`${adminUrl(id)}/decision`, 'admin', 'PUT', { status: 'resolved', decision: 'approved', public_response: 'Onaylandı.' });
        assert.equal((await request(commentUrl, 'assignee', 'POST', form())).status, 409);
        const publicDownload = await request(`${employeeUrl(id)}/comments/${owner.comments[0].id}/attachment`, 'owner');
        assert.equal(publicDownload.status, 200);
        assert.deepEqual(Buffer.from(await publicDownload.arrayBuffer()), bytes);
    });

    await t.test('private decisions and legacy history notes never appear in employee APIs', async () => {
        const id = await create();
        await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment);
        await db.run('UPDATE feedback SET decision_note = ? WHERE id = ?', ['PRIVATE DECISION', id]);
        await db.run('INSERT INTO feedback_status_history (feedback_id, user_id, new_status, note) VALUES (?, ?, ?, ?)', [id, ids.admin, 'in_review', 'LEGACY SECRET']);
        for (const [url, name] of [[`${employeeUrl(id)}/detail`, 'owner'], ['/api/feedback/mine', 'owner'], ['/api/feedback/participating', 'assignee'], [`${employeeUrl(id)}/thread`, 'owner'], [`${employeeUrl(id)}/thread`, 'participant']]) {
            const response = await request(url, name); assert.equal(response.status, 200);
            const text = await response.text();
            assert.ok(!text.includes('PRIVATE DECISION')); assert.ok(!text.includes('LEGACY SECRET')); assert.ok(!text.includes('decision_note'));
        }
        const admin = await (await request(`${adminUrl(id)}/detail`)).json();
        assert.equal(admin.decision_note, 'PRIVATE DECISION');
        assert.equal((await request(`${adminUrl(id)}/detail`, 'owner')).status, 403);
    });

    await t.test('rejected decisions persist as rejected and stay closed for suggestions and complaints', async () => {
        for (const type of ['suggestion', 'complaint']) {
            const id = await create('in_review');
            await db.run('UPDATE feedback SET type = ? WHERE id = ?', [type, id]);
            assert.equal((await request(`${adminUrl(id)}/decision`, 'admin', 'PUT', { status: 'rejected', decision: 'rejected' })).status, 400);
            // Older clients still send resolved for every decision.
            const response = await request(`${adminUrl(id)}/decision`, 'admin', 'PUT', {
                status: type === 'suggestion' ? 'resolved' : 'rejected', decision: 'rejected', public_response: 'Talebiniz uygun bulunmadı.',
            });
            assert.equal(response.status, 200);
            assert.equal((await db.get('SELECT status FROM feedback WHERE id = ?', [id])).status, 'rejected');
            assert.equal((await (await request(`${employeeUrl(id)}/detail`, 'owner')).json()).status, 'rejected');
            assert.equal((await db.get('SELECT new_status FROM feedback_status_history WHERE feedback_id = ? ORDER BY id DESC', [id])).new_status, 'rejected');
            assert.equal((await request(`${employeeUrl(id)}/comments`, 'owner', 'POST', { comment: 'Kapalı kayıt' })).status, 409);
        }
    });

    await t.test('final decisions are displayed and filtered separately from workflow stages', async () => {
        const idsByDecision = new Map();
        for (const decision of ['approved', 'needs_revision', 'deferred']) {
            const id = await create('in_review');
            idsByDecision.set(decision, id);
            assert.equal((await request(`${adminUrl(id)}/decision`, 'admin', 'PUT', { decision, public_response: 'Resmî yanıt' })).status, 200);
            for (const [url, user] of [[adminUrl(id), 'admin'], [employeeUrl(id), 'owner']]) {
                const detail = await (await request(`${url}/detail`, user)).json();
                assert.equal(detail.status, 'resolved');
                assert.equal(detail.display_status, decision);
            }
            assert.equal((await db.get('SELECT new_status FROM feedback_status_history WHERE feedback_id = ? ORDER BY id DESC', [id])).new_status, decision);
            assert.equal((await request(`${employeeUrl(id)}/comments`, 'owner', 'POST', { comment: 'Kapalı kayıt' })).status, 409);
        }
        const legacyOpen = await create('approved');
        const legacyWaiting = await create('waiting_opinion');
        const legacyClosed = await create('completed');
        for (const [decision, id] of idsByDecision) {
            const result = await (await request(`/api/admin/feedback?status=${decision}&pageSize=100`)).json();
            assert.equal(result.items.some(item => item.id === id), true);
            assert.ok(result.items.every(item => item.display_status === decision));
        }
        const review = await (await request('/api/admin/feedback?status=in_review&pageSize=100')).json();
        assert.ok([legacyOpen, legacyWaiting].every(id => review.items.some(item => item.id === id && item.display_status === 'in_review')));
        const completed = await (await request('/api/admin/feedback?status=completed')).json();
        assert.ok(completed.items.some(item => item.id === legacyClosed));
        const reopened = idsByDecision.get('deferred');
        assert.equal((await request(`${adminUrl(reopened)}/status`, 'admin', 'PUT', { status: 'in_review' })).status, 200);
        assert.equal((await (await request(`${employeeUrl(reopened)}/detail`, 'owner')).json()).display_status, 'in_review');
    });

    await t.test('legacy rejected results are consistent in lists, details and paginated filters without rewriting history', async () => {
        for (const status of ['resolved', 'completed']) {
            const id = await create(status);
            await db.run('UPDATE feedback SET decision = ?, assigned_to_user_id = ? WHERE id = ?', ['rejected', ids.assignee, id]);
            for (const [url, name] of [[`${adminUrl(id)}/detail`, 'admin'], [`${employeeUrl(id)}/detail`, 'owner']]) {
                assert.equal((await (await request(url, name)).json()).status, 'rejected');
            }
            for (const [url, name] of [['/api/feedback/mine', 'owner'], ['/api/feedback/participating', 'assignee']]) {
                assert.equal((await (await request(url, name)).json()).find(item => item.id === id).status, 'rejected');
            }
            const rejected = await (await request('/api/admin/feedback?status=rejected&pageSize=100&sort=status')).json();
            assert.equal(rejected.items.find(item => item.id === id).status, 'rejected');
            assert.equal(rejected.pagination.total, rejected.items.length);
            const completed = await (await request('/api/admin/feedback?status=resolved&pageSize=100')).json();
            assert.ok(!completed.items.some(item => item.id === id));
            assert.equal((await db.get('SELECT status FROM feedback WHERE id = ?', [id])).status, status);
            assert.equal((await request(`${adminUrl(id)}/status`, 'admin', 'PUT', { status: 'in_review' })).status, 200);
            assert.equal((await (await request(`${employeeUrl(id)}/detail`, 'owner')).json()).status, 'in_review');
        }
    });

    await t.test('closure locks all comments and assignments until explicit reopen', async () => {
        const id = await create();
        await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment);
        assert.equal((await request(`${adminUrl(id)}/decision`, 'admin', 'PUT', { status: 'resolved', decision: 'approved' })).status, 400);
        const result = { status: 'resolved', decision: 'approved', decision_note: 'PRIVATE CLOSE', public_response: 'Öneriniz onaylandı.' };
        assert.equal((await request(`${adminUrl(id)}/decision`, 'admin', 'PUT', result)).status, 200);
        for (const name of ['owner', 'participant', 'admin']) {
            const url = name === 'admin' ? adminUrl(id) : employeeUrl(id);
            assert.equal((await request(`${url}/comments`, name, 'POST', { comment: 'After closure' })).status, 409);
        }
        assert.equal((await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment)).status, 409);
        assert.equal((await request(`${adminUrl(id)}/participants`, 'admin', 'POST', { user_ids: [ids.outsider] })).status, 409);
        assert.equal((await request(`${adminUrl(id)}/decision`, 'admin', 'PUT', result)).status, 409);
        const detail = await (await request(`${employeeUrl(id)}/detail`, 'owner')).json();
        assert.equal(detail.can_comment, false); assert.equal(detail.public_response, 'Öneriniz onaylandı.');
        const history = await (await request(`${employeeUrl(id)}/thread`, 'owner')).text();
        assert.ok(!history.includes('PRIVATE CLOSE'));
        assert.equal((await request(`${adminUrl(id)}/status`, 'admin', 'PUT', { status: 'in_review' })).status, 200);
        assert.equal((await request(`${employeeUrl(id)}/comments`, 'owner', 'POST', { comment: 'After reopen' })).status, 200);
    });

    await t.test('assignee completes their own review once without closing the request', async () => {
        const id = await create();
        await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment);
        for (const name of ['owner', 'participant', 'outsider']) assert.equal((await request(`${employeeUrl(id)}/review-completion`, name, 'POST')).status, 403);
        assert.equal((await request(`${employeeUrl(id)}/review-completion`, 'assignee', 'POST')).status, 200);
        const count = (await db.get('SELECT COUNT(*) AS total FROM feedback_status_history WHERE feedback_id = ?', [id])).total;
        assert.equal((await request(`${employeeUrl(id)}/review-completion`, 'assignee', 'POST')).status, 200);
        assert.equal((await db.get('SELECT COUNT(*) AS total FROM feedback_status_history WHERE feedback_id = ?', [id])).total, count);
        assert.equal((await db.get('SELECT status FROM feedback WHERE id = ?', [id])).status, 'in_review');
        assert.ok((await db.get('SELECT review_completed_at FROM feedback_participants WHERE feedback_id = ? AND user_id = ?', [id, ids.assignee])).review_completed_at);
    });

    await t.test('replacement removes participant access and supports legacy type filters', async () => {
        const id = await create();
        await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', assignment);
        const replacement = { ...assignment, participant_user_ids: [], replace_participants: true };
        assert.equal((await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', replacement)).status, 200);
        assert.equal((await request(`${employeeUrl(id)}/detail`, 'participant')).status, 403);
        assert.equal((await request(`${employeeUrl(id)}/detail`, 'assignee')).status, 200);
        await db.run('UPDATE feedback SET type = ? WHERE id = ?', ['Öneri', id]);
        const list = await (await request('/api/admin/feedback?type=suggestion')).json();
        assert.ok(list.items.some(item => item.id === id));
    });

    await t.test('assignment notes are shared with the team and hidden from the owner', async () => {
        const id = await create('in_review');
        assert.equal((await request(`${adminUrl(id)}/assignment`, 'admin', 'PUT', { ...assignment, note: 'TEAM ASSIGNMENT NOTE' })).status, 200);
        const owner = await (await request(`${employeeUrl(id)}/thread`, 'owner')).text();
        const participant = await (await request(`${employeeUrl(id)}/thread`, 'participant')).json();
        assert.ok(!owner.includes('TEAM ASSIGNMENT NOTE'));
        assert.ok(participant.comments.some(comment => comment.comment === 'TEAM ASSIGNMENT NOTE' && !comment.is_public));
        assert.equal((await db.get('SELECT status FROM feedback WHERE id = ?', [id])).status, 'in_review');
    });

    await t.test('review completion migration rolls back and reapplies without losing participants', async () => {
        const migration = require('../migrations/definitions/feedback')[0];
        const before = await db.all('SELECT id, user_id FROM feedback_participants ORDER BY id');
        await migration.down(db);
        assert.ok(!(await db.all('PRAGMA table_info(feedback_participants)')).some(column => column.name === 'review_completed_at'));
        await migration.up(db);
        assert.ok((await db.all('PRAGMA table_info(feedback_participants)')).some(column => column.name === 'review_completed_at'));
        assert.deepEqual(await db.all('SELECT id, user_id FROM feedback_participants ORDER BY id'), before);
    });

    await t.test('anonymous submission does not disclose the creator through history', async () => {
        assert.equal((await request('/api/feedback', 'owner', 'POST', { type: 'complaint', title: 'Anonymous example', content: 'Test content', is_anonymous: true })).status, 200);
        const feedback = await db.get('SELECT * FROM feedback WHERE title = ?', ['Anonymous example']);
        assert.equal(feedback.user_id, null);
        const thread = await (await request(`${adminUrl(feedback.id)}/thread`)).json();
        assert.equal(thread.history[0].user_id, null);
        assert.equal(thread.history[0].user_name, null);
    });
});
