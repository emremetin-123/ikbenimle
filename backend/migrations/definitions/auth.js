module.exports = [
    {
        version: '001_security_sessions',
        async up(db) {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token_hash TEXT NOT NULL UNIQUE,
                    csrf_hash TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    idle_expires_at DATETIME NOT NULL,
                    absolute_expires_at DATETIME NOT NULL,
                    revoked_at DATETIME,
                    user_agent_hash TEXT,
                    ip_address TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
                CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active
                    ON auth_sessions(user_id, revoked_at, absolute_expires_at);

                CREATE TABLE IF NOT EXISTS security_audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    event_type TEXT NOT NULL,
                    success INTEGER NOT NULL DEFAULT 1,
                    ip_address TEXT,
                    user_agent TEXT,
                    metadata TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_security_audit_created
                    ON security_audit_events(created_at);
                CREATE INDEX IF NOT EXISTS idx_security_audit_user
                    ON security_audit_events(user_id, created_at);
            `);
        },
        async down(db) {
            await db.exec(`
                DROP TABLE IF EXISTS auth_sessions;
                DROP TABLE IF EXISTS security_audit_events;
            `);
        }
    },
    {
        version: '002_remove_plaintext_secrets',
        async up(db) {
            const secretMappings = [
                ['gemini_api_key', 'GEMINI_API_KEY'],
                ['vapid_private_key', 'VAPID_PRIVATE_KEY']
            ];
            for (const [settingKey, envKey] of secretMappings) {
                const legacy = await db.get(
                    'SELECT value FROM app_settings WHERE setting_key = ?',
                    [settingKey]
                );
                if (legacy?.value && !process.env[envKey]) {
                    throw new Error(
                        `SECURE_SECRET_MIGRATION_REQUIRED: set ${envKey} in the server environment before migration`
                    );
                }
                if (process.env[envKey]) {
                    await db.run('DELETE FROM app_settings WHERE setting_key = ?', [settingKey]);
                }
            }
        },
        async down() {
            // Removed plaintext secrets are intentionally not restored.
        }
    },
    {
        version: '003_scheduler_leases',
        async up(db) {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS scheduler_locks (
                    lock_name TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    lock_until DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `);
        },
        async down(db) {
            await db.exec('DROP TABLE IF EXISTS scheduler_locks;');
        }
    },
    {
        version: '006_persistent_login_guards',
        async up(db) {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS auth_login_guards (
                    key_hash TEXT PRIMARY KEY,
                    guard_type TEXT NOT NULL,
                    failed_count INTEGER NOT NULL DEFAULT 0,
                    window_started_at DATETIME NOT NULL,
                    locked_until DATETIME,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_auth_login_guards_locked
                    ON auth_login_guards(locked_until, updated_at);
            `);
        },
        async down(db) {
            await db.exec('DROP TABLE IF EXISTS auth_login_guards;');
        }
    },
    {
        version: '007_revoke_legacy_sessions',
        async up(db) {
            await db.run(
                `UPDATE auth_sessions
                 SET revoked_at = CURRENT_TIMESTAMP
                 WHERE revoked_at IS NULL`
            );
        },
        async down() {
            // Session revocation is a security boundary and cannot be reversed.
        }
    },
];
