module.exports = [{
    version: '021_structured_profile_details',
    async up(db, dialect) {
        const primaryKey = dialect === 'postgres'
            ? 'SERIAL PRIMARY KEY'
            : 'INTEGER PRIMARY KEY AUTOINCREMENT';
        await db.exec(`
            CREATE TABLE profile_education_entries (
                id ${primaryKey},
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                school TEXT NOT NULL,
                department TEXT,
                start_year INTEGER,
                end_year INTEGER,
                is_current INTEGER NOT NULL DEFAULT 0,
                order_index INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX idx_profile_education_user
                ON profile_education_entries(user_id, order_index, id);

            CREATE TABLE profile_interests (
                id ${primaryKey},
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                kind TEXT NOT NULL CHECK(kind IN ('skill', 'hobby')),
                label TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                UNIQUE(user_id, kind, label)
            );
            CREATE INDEX idx_profile_interests_user
                ON profile_interests(user_id, kind, order_index, id);
        `);
    },
    async down(db) {
        await db.exec(`
            DROP TABLE IF EXISTS profile_interests;
            DROP TABLE IF EXISTS profile_education_entries;
        `);
    }
}];
