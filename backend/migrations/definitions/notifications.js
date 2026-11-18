module.exports = [
    {
        version: '011_notification_query_indexes',
        async up(db) {
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active_user
                    ON push_subscriptions(is_active, user_id, id);
                CREATE INDEX IF NOT EXISTS idx_notification_routines_active_schedule
                    ON notification_routines(is_active, scheduled_time, id);
            `);
        },
        async down(db) {
            for (const [index] of [
                ['idx_push_subscriptions_active_user', 'push_subscriptions'],
                ['idx_notification_routines_active_schedule', 'notification_routines']
            ]) {
                await db.exec(`DROP INDEX IF EXISTS ${index};`);
            }
        }
    },
];
