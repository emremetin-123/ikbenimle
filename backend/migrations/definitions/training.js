module.exports = [
    {
        version: '017_training_progress_sessions',
        async up(db) {
            await db.exec(`
                ALTER TABLE lesson_progress
                    ADD COLUMN server_active_seconds INTEGER NOT NULL DEFAULT 0;

                CREATE TABLE IF NOT EXISTS training_progress_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    assignment_id INTEGER NOT NULL,
                    lesson_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL,
                    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_heartbeat_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_position REAL NOT NULL DEFAULT 0,
                    duration_seconds INTEGER NOT NULL DEFAULT 0,
                    expires_at DATETIME NOT NULL,
                    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
                    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(assignment_id, lesson_id)
                );

                CREATE INDEX IF NOT EXISTS idx_training_progress_sessions_expiry
                    ON training_progress_sessions(expires_at);
            `);
        },
        async down(db) {
            await db.exec(`
                DROP INDEX IF EXISTS idx_training_progress_sessions_expiry;
                DROP TABLE IF EXISTS training_progress_sessions;
                ALTER TABLE lesson_progress DROP COLUMN server_active_seconds;
            `);
        }
    },
    {
        version: '018_training_assignment_integrity',
        async up(db) {
            await db.exec(`
                ALTER TABLE assignments
                    ADD COLUMN training_root_id INTEGER;
            `);
            await db.run(`
                UPDATE assignments
                SET training_root_id = (
                    SELECT COALESCE(v.parent_video_id, v.id)
                    FROM videos v
                    WHERE v.id = assignments.video_id
                )
            `);
            const duplicate = await db.get(`
                SELECT user_id, training_root_id, COUNT(*) AS total
                FROM assignments
                WHERE status NOT IN ('completed', 'cancelled')
                  AND voided_at IS NULL
                  AND training_root_id IS NOT NULL
                GROUP BY user_id, training_root_id
                HAVING COUNT(*) > 1
                LIMIT 1
            `);
            if (duplicate) {
                throw new Error(
                    `DUPLICATE_ACTIVE_TRAINING_ASSIGNMENTS: user=${duplicate.user_id}, root=${duplicate.training_root_id}`
                );
            }
            await db.exec(`
                CREATE UNIQUE INDEX IF NOT EXISTS ux_assignments_active_training_root
                    ON assignments(user_id, training_root_id)
                    WHERE status NOT IN ('completed', 'cancelled')
                      AND voided_at IS NULL
                      AND training_root_id IS NOT NULL;
            `);
        },
        async down(db) {
            await db.exec(`
                DROP INDEX IF EXISTS ux_assignments_active_training_root;
                ALTER TABLE assignments DROP COLUMN training_root_id;
            `);
        }
    }
];
