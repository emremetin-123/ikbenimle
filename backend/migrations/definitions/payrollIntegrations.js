module.exports = [{
    version: '025_payroll_integration',
    async up(db) {
        await db.exec(`
            CREATE TABLE integration_payrolls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                connection_id INTEGER NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
                external_payroll_id TEXT NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                period TEXT NOT NULL,
                revision INTEGER NOT NULL,
                content_hash TEXT NOT NULL,
                document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (connection_id, external_payroll_id),
                UNIQUE (connection_id, user_id, period)
            );
            CREATE INDEX idx_integration_payroll_document ON integration_payrolls(document_id);
        `);
    },
    async down(db) {
        await db.exec('DROP TABLE IF EXISTS integration_payrolls;');
    }
}];
