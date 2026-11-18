const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DB_TYPE = 'sqlite';
process.env.SEED_DEFAULT_USERS = 'false';
process.env.NODE_ENV = 'test';

const setupDb = require('../database');
const { runMigrations } = require('../migrations');
const {
    cloudinaryKeyFromUrl,
    createUploadStorageService
} = require('../services/uploadStorageService');
const { createFeedbackRepository } = require('../modules/feedback/feedbackRepository');
const { createFeedbackService } = require('../modules/feedback/feedbackService');
const { createDocumentFileService } = require('../modules/personalInfo/documentFileService');

test('upload storage Cloudinary metadata ve sinirli cleanup retry uygular', async () => {
    let deleteAttempts = 0;
    const storage = createUploadStorageService({
        useCloudinary: true,
        uploadToCloudinary: async () => ({
            url: 'https://cdn.example.test/file.pdf',
            public_id: 'calisanportal/feedback/file'
        }),
        deleteFromCloudinary: async () => {
            deleteAttempts += 1;
            if (deleteAttempts < 3) throw new Error('temporary delete failure');
        }
    });

    const stored = await storage.store({
        buffer: Buffer.from('%PDF-test'),
        mimetype: 'application/pdf'
    }, 'feedback');
    assert.deepEqual(stored, {
        filePath: 'https://cdn.example.test/file.pdf',
        provider: 'cloudinary',
        storageKey: 'calisanportal/feedback/file'
    });

    await storage.remove(stored);
    assert.equal(deleteAttempts, 3);
    assert.equal(
        cloudinaryKeyFromUrl(
            'https://res.cloudinary.com/demo/raw/upload/v123/calisanportal/documents/old-file.pdf'
        ),
        'calisanportal/documents/old-file'
    );
});

test('feedback DB hatasinda yeni dosyayi temizler ve transaction yazilarini geri alir', async t => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-storage-'));
    process.env.SQLITE_FILENAME = path.join(tempDir, 'test.sqlite');
    const db = await setupDb();
    await runMigrations(db);
    const user = await db.run(
        'INSERT INTO users (employee_id, name, role, status) VALUES (?, ?, ?, ?)',
        ['feedback-storage-user', 'Feedback User', 'employee', 'active']
    );
    t.after(async () => {
        await db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const removed = [];
    const transaction = work => db.transaction(async tx => {
        const txRepository = createFeedbackRepository(tx);
        return work({
            ...txRepository,
            addHistory: async () => {
                throw new Error('history write failed');
            }
        });
    });
    const service = createFeedbackService(createFeedbackRepository(db), {
        transaction,
        storeFile: async () => ({
            filePath: '/uploads/feedback/new.pdf',
            provider: 'local',
            storageKey: 'new.pdf'
        }),
        removeStoredFile: async stored => removed.push(stored)
    });

    await assert.rejects(
        service.create({
            is_anonymous: false,
            type: 'suggestion',
            title: 'Test',
            content: 'Test content'
        }, user.lastID, { file: { filename: 'new.pdf' }, suggestion: true }),
        /history write failed/
    );
    assert.equal((await db.get('SELECT COUNT(*) AS total FROM feedback')).total, 0);
    assert.equal(removed.length, 1);

    const feedback = await db.run(
        'INSERT INTO feedback (user_id, type, title, content, status) VALUES (?, ?, ?, ?, ?)',
        [user.lastID, 'suggestion', 'Rollback', 'Test', 'assigned']
    );
    await assert.rejects(
        service.addUserComment(feedback.lastID, { id: user.lastID }, { comment: 'İlk görüş' }),
        /history write failed/
    );
    assert.equal(
        (await db.get('SELECT status FROM feedback WHERE id = ?', [feedback.lastID])).status,
        'assigned'
    );
    assert.equal((await db.get('SELECT COUNT(*) AS total FROM feedback_comments WHERE feedback_id = ?', [feedback.lastID])).total, 0);
});

test('belge storage islemleri DB hatasinda gorunen kaydi ve yeni dosyayi korumaz', async () => {
    const removed = [];
    const stored = {
        filePath: '/uploads/documents/new.pdf',
        provider: 'local',
        storageKey: 'new.pdf'
    };
    const storage = {
        store: async () => stored,
        remove: async value => removed.push(value)
    };
    const failedCreate = createDocumentFileService({
        run: async () => { throw new Error('insert failed'); }
    }, storage);
    await assert.rejects(
        failedCreate.uploadDocument({
            file: { filename: 'new.pdf' },
            userId: 1,
            title: 'Belge',
            adminId: 2
        }),
        /insert failed/
    );
    assert.deepEqual(removed, [stored]);

    removed.length = 0;
    const failedDelete = createDocumentFileService({
        get: async () => ({
            file_path: '/uploads/documents/existing.pdf',
            storage_provider: 'local',
            storage_key: 'existing.pdf'
        }),
        run: async () => { throw new Error('delete failed'); }
    }, storage);
    await assert.rejects(failedDelete.deleteDocument(7), /delete failed/);
    assert.equal(removed.length, 0);
});
