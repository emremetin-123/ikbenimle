module.exports = [
    {
        version: '014_personal_reminders',
        async up(db) {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS personal_reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    reminder_text TEXT NOT NULL CHECK(length(reminder_text) <= 300),
                    is_completed INTEGER NOT NULL DEFAULT 0,
                    is_pinned INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_personal_reminders_user_state
                    ON personal_reminders(user_id, is_completed, is_pinned, updated_at, id);
            `);
        },
        async down(db) {
            await db.exec('DROP TABLE IF EXISTS personal_reminders;');
        }
    }
];
