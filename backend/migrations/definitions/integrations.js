module.exports = [
    {
        version: '015_integration_gateway',
        async up(db) {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS integration_connections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    provider TEXT NOT NULL DEFAULT 'logo_bridge',
                    is_enabled INTEGER NOT NULL DEFAULT 0,
                    employee_sync_enabled INTEGER NOT NULL DEFAULT 1,
                    leave_balance_sync_enabled INTEGER NOT NULL DEFAULT 1,
                    leave_request_export_enabled INTEGER NOT NULL DEFAULT 1,
                    leave_export_trigger TEXT NOT NULL DEFAULT 'created',
                    default_permissions_json TEXT NOT NULL DEFAULT '[]',
                    last_seen_at DATETIME,
                    last_success_at DATETIME,
                    last_error_at DATETIME,
                    last_error_code TEXT,
                    created_by INTEGER,
                    updated_by INTEGER,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id),
                    FOREIGN KEY (updated_by) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS integration_api_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    key_prefix TEXT NOT NULL,
                    token_hash TEXT NOT NULL UNIQUE,
                    scopes_json TEXT NOT NULL,
                    ip_allowlist_json TEXT NOT NULL DEFAULT '[]',
                    expires_at DATETIME,
                    revoked_at DATETIME,
                    last_used_at DATETIME,
                    created_by INTEGER,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS integration_employee_mappings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id INTEGER NOT NULL,
                    external_employee_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    source_updated_at DATETIME,
                    last_synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (connection_id, external_employee_id),
                    UNIQUE (connection_id, user_id),
                    FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS integration_leave_balances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    external_employee_id TEXT NOT NULL,
                    balance_days REAL NOT NULL,
                    as_of_date DATE NOT NULL,
                    source_updated_at DATETIME,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (connection_id, user_id),
                    FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS integration_outbox (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    aggregate_type TEXT NOT NULL,
                    aggregate_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    payload_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    max_attempts INTEGER NOT NULL DEFAULT 8,
                    available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    locked_until DATETIME,
                    locked_by_api_key_id INTEGER,
                    external_reference TEXT,
                    last_error_code TEXT,
                    last_error_message TEXT,
                    completed_at DATETIME,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE,
                    FOREIGN KEY (locked_by_api_key_id) REFERENCES integration_api_keys(id)
                );

                CREATE TABLE IF NOT EXISTS integration_idempotency_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id INTEGER NOT NULL,
                    api_key_id INTEGER NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    request_method TEXT NOT NULL,
                    request_path TEXT NOT NULL,
                    response_status INTEGER NOT NULL,
                    response_json TEXT NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    UNIQUE (connection_id, request_method, request_path, idempotency_key),
                    FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE,
                    FOREIGN KEY (api_key_id) REFERENCES integration_api_keys(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS integration_audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id INTEGER,
                    api_key_id INTEGER,
                    actor_user_id INTEGER,
                    direction TEXT NOT NULL,
                    action TEXT NOT NULL,
                    status TEXT NOT NULL,
                    entity_type TEXT,
                    entity_id TEXT,
                    request_id TEXT,
                    details_json TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE SET NULL,
                    FOREIGN KEY (api_key_id) REFERENCES integration_api_keys(id) ON DELETE SET NULL,
                    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS idx_integration_connections_enabled
                    ON integration_connections(is_enabled, id);
                CREATE INDEX IF NOT EXISTS idx_integration_api_keys_connection
                    ON integration_api_keys(connection_id, revoked_at, expires_at);
                CREATE INDEX IF NOT EXISTS idx_integration_employee_user
                    ON integration_employee_mappings(user_id, connection_id);
                CREATE INDEX IF NOT EXISTS idx_integration_leave_balance_user
                    ON integration_leave_balances(user_id, updated_at);
                CREATE INDEX IF NOT EXISTS idx_integration_outbox_claim
                    ON integration_outbox(connection_id, status, available_at, locked_until, id);
                CREATE INDEX IF NOT EXISTS idx_integration_audit_connection_created
                    ON integration_audit_events(connection_id, created_at, id);
                CREATE INDEX IF NOT EXISTS idx_integration_idempotency_expiry
                    ON integration_idempotency_records(expires_at);
            `);
        },
        async down(db) {
            await db.exec(`
                DROP TABLE IF EXISTS integration_audit_events;
                DROP TABLE IF EXISTS integration_idempotency_records;
                DROP TABLE IF EXISTS integration_outbox;
                DROP TABLE IF EXISTS integration_leave_balances;
                DROP TABLE IF EXISTS integration_employee_mappings;
                DROP TABLE IF EXISTS integration_api_keys;
                DROP TABLE IF EXISTS integration_connections;
            `);
        }
    }
];
