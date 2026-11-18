module.exports = [
    {
        version: '013_anonymize_mood_responses',
        async up(db, dialect) {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS anonymous_mood_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mood_date TEXT NOT NULL,
                    mood_id TEXT NOT NULL,
                    mood_label TEXT NOT NULL,
                    mood_score INTEGER NOT NULL,
                    reason_key TEXT,
                    reason_label TEXT,
                    department TEXT
                );
                CREATE TABLE IF NOT EXISTS mood_callback_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    requested_date TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    handled_at DATETIME,
                    handled_by INTEGER,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (handled_by) REFERENCES users(id),
                    UNIQUE(user_id, requested_date)
                );
            `);

            const legacyTable = dialect === 'postgres'
                ? await db.get(`
                    SELECT table_name AS name
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'mood_checks'
                `)
                : await db.get(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mood_checks'"
                );
            if (legacyTable) {
                await db.exec(`
                    INSERT INTO anonymous_mood_checks (
                        mood_date, mood_id, mood_label, mood_score, reason_key,
                        reason_label, department
                    )
                    SELECT
                        mood_date, mood_id, mood_label, mood_score, reason_key,
                        reason_label, department
                    FROM mood_checks;

                    INSERT INTO mood_callback_requests (
                        user_id, requested_date, status, created_at
                    )
                    SELECT user_id, mood_date, 'pending', created_at
                    FROM mood_checks
                    WHERE wants_callback = 1;

                    DROP TABLE mood_checks;
                `);
            }
            await db.exec(`
                CREATE INDEX IF NOT EXISTS ix_anonymous_mood_date_department
                    ON anonymous_mood_checks(mood_date, department);
                CREATE INDEX IF NOT EXISTS ix_mood_callback_date_status
                    ON mood_callback_requests(requested_date, status);
            `);
        },
        async down(db, dialect) {
            const moodCount = await db.get(
                'SELECT COUNT(*) AS total FROM anonymous_mood_checks'
            );
            const callbackCount = await db.get(
                'SELECT COUNT(*) AS total FROM mood_callback_requests'
            );
            if (Number(moodCount?.total || 0) > 0 || Number(callbackCount?.total || 0) > 0) {
                throw new Error('MOOD_ANONYMIZATION_ROLLBACK_REQUIRES_EMPTY_TABLES');
            }
            await db.exec(`
                DROP TABLE mood_callback_requests;
                DROP TABLE anonymous_mood_checks;
                CREATE TABLE mood_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    mood_date TEXT NOT NULL,
                    mood_id TEXT NOT NULL,
                    mood_label TEXT NOT NULL,
                    mood_score INTEGER NOT NULL,
                    wants_callback INTEGER DEFAULT 0,
                    reason_key TEXT,
                    reason_label TEXT,
                    department TEXT,
                    position TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(user_id, mood_date)
                );
            `);
        }
    }
];
