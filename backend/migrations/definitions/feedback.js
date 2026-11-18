module.exports = [{
    version: '022_feedback_review_completion',
    async up(db) {
        await db.exec('ALTER TABLE feedback_participants ADD COLUMN review_completed_at TEXT;');
    },
    async down(db) {
        await db.exec('ALTER TABLE feedback_participants DROP COLUMN review_completed_at;');
    }
}, {
    version: '026_feedback_comment_attachments',
    async up(db) {
        await db.exec('ALTER TABLE feedback_comments ADD COLUMN attachment_key TEXT;');
        await db.exec('ALTER TABLE feedback_comments ADD COLUMN attachment_name TEXT;');
    },
    async down(db) {
        await db.exec('ALTER TABLE feedback_comments DROP COLUMN attachment_name;');
        await db.exec('ALTER TABLE feedback_comments DROP COLUMN attachment_key;');
    }
}];
