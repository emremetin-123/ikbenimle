require('dotenv').config();

const setupDb = require('../database');

const checks = [
    {
        relation: 'users.manager_id -> users.id',
        sql: `SELECT COUNT(*) AS total
              FROM users child
              LEFT JOIN users parent ON parent.id = child.manager_id
              WHERE child.manager_id IS NOT NULL AND parent.id IS NULL`
    },
    {
        relation: 'videos.parent_video_id -> videos.id',
        sql: `SELECT COUNT(*) AS total
              FROM videos child
              LEFT JOIN videos parent ON parent.id = child.parent_video_id
              WHERE child.parent_video_id IS NOT NULL AND parent.id IS NULL`
    },
    {
        relation: 'feedback.assigned_to_user_id -> users.id',
        sql: `SELECT COUNT(*) AS total
              FROM feedback item
              LEFT JOIN users assignee ON assignee.id = item.assigned_to_user_id
              WHERE item.assigned_to_user_id IS NOT NULL AND assignee.id IS NULL`
    }
];

const auditRelationIntegrity = async (db) => {
    const results = [];
    for (const check of checks) {
        const row = await db.get(check.sql);
        results.push({ relation: check.relation, orphan_count: Number(row?.total || 0) });
    }
    return results;
};

const run = async () => {
    const db = await setupDb();
    try {
        const results = await auditRelationIntegrity(db);
        console.table(results);
        if (results.some(item => item.orphan_count > 0)) process.exitCode = 2;
    } finally {
        await db.close();
    }
};

if (require.main === module) {
    run().catch(error => {
        console.error('Relation integrity audit failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { auditRelationIntegrity };
