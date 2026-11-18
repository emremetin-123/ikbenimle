module.exports = [{
    version: '024_application_audit_logs',
    async up(db, dialect) {
        await db.exec(`
            CREATE TABLE application_audit_events (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                actor_id INTEGER,
                actor_name TEXT,
                actor_employee_id TEXT,
                module TEXT NOT NULL,
                action TEXT NOT NULL,
                resource_id TEXT,
                method TEXT NOT NULL,
                outcome TEXT NOT NULL DEFAULT 'pending',
                http_status INTEGER,
                retention_days INTEGER NOT NULL DEFAULT 365,
                ip_address TEXT,
                request_id TEXT,
                details TEXT NOT NULL DEFAULT '{}'
            );
            CREATE INDEX idx_app_audit_created ON application_audit_events(created_at, id);
            CREATE INDEX idx_app_audit_actor ON application_audit_events(actor_id, created_at);
            CREATE INDEX idx_app_audit_module ON application_audit_events(module, action, created_at);
            CREATE TABLE audit_log_holds (
                source TEXT NOT NULL,
                event_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                held_by INTEGER NOT NULL,
                held_by_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (source, event_id)
            );
            CREATE TABLE audit_log_purge_runs (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                general_count INTEGER NOT NULL,
                critical_count INTEGER NOT NULL,
                security_count INTEGER NOT NULL
            );
            CREATE INDEX idx_audit_purge_created ON audit_log_purge_runs(created_at);
            CREATE TABLE audit_log_control (id INTEGER PRIMARY KEY, last_purge_day TEXT);
            INSERT INTO audit_log_control (id) VALUES (1);
            ALTER TABLE security_audit_events ADD COLUMN actor_name TEXT;
            ALTER TABLE security_audit_events ADD COLUMN actor_employee_id TEXT;
            ALTER TABLE security_audit_events ADD COLUMN audit_created_at TEXT;
            CREATE INDEX idx_security_audit_time ON security_audit_events(audit_created_at);
            UPDATE security_audit_events SET actor_name = (SELECT name FROM users WHERE users.id = security_audit_events.user_id),
                actor_employee_id = (SELECT employee_id FROM users WHERE users.id = security_audit_events.user_id);
        `);
        await db.exec(dialect === 'postgres'
            ? "UPDATE security_audit_events SET audit_created_at = to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS');"
            : "UPDATE security_audit_events SET audit_created_at = REPLACE(CAST(created_at AS TEXT), 'T', ' ');");
    },
    async down(db) {
        await db.exec(`
            DROP INDEX idx_security_audit_time;
            ALTER TABLE security_audit_events DROP COLUMN audit_created_at;
            ALTER TABLE security_audit_events DROP COLUMN actor_employee_id;
            ALTER TABLE security_audit_events DROP COLUMN actor_name;
            DROP TABLE audit_log_purge_runs;
            DROP TABLE audit_log_control;
            DROP TABLE audit_log_holds;
            DROP TABLE application_audit_events;
        `);
    }
}];
