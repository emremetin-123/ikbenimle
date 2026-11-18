const crypto = require('node:crypto');
const { MIGRATIONS } = require('./definitions');

// Historical checksums accepted only to migrate metadata after removing the
// retired database adapter branches from already-applied migrations.
const PREVIOUS_CHECKSUMS = new Map(Object.entries({
    '000_initial_schema': ['9ce2e87ae0beb94c4f5ee76ea1a1be1d9064f6e744bda5e66cc4cffa0788478f'],
    '001_security_sessions': ['c388af4b13409d1d827212e76c3c57596ed6d402a6a4588624a4a8c0f833a5a5'],
    '003_scheduler_leases': ['e01eb13afa136e6cb18142a48fc4812fa11fa0dc5232fa1f1c274ad9d42ea7bf'],
    '004_query_indexes': ['b66c46e5525d8bb74f3a07aeabe0b6833b854416b15d17624c4b73a6f83cfafa'],
    '005_architecture_query_indexes': ['f9a726070ca2c08cdd60e32081af4a626b9ba1e54232b4a4b1f5cb0f3d59b83f'],
    '006_persistent_login_guards': ['7b8146d78dfd7405991c19d625ccfa37206234633a754dec2ab3008d9c3f232a'],
    '008_career_query_indexes': ['a766844495edc11a8600d0efd432c860287ed19145e20f0f21fb8cb2072d682d'],
    '009_leave_directory_query_indexes': ['4e570be0a54f7e7793894056d21cea175a98571318d3f43129879416022cc87a'],
    '010_knowledge_service_route_indexes': ['8b750f3969a3ef5c60d006b84408f70b9b99fe4336f912af51e1aec06a594aad'],
    '011_notification_query_indexes': ['00732f30870fc59bc352fedb13415ec778a5b01d07f42b65171cdc3dd7c86fc5'],
    '012_meal_rating_query_indexes': ['0e010dd690f31bc8475f00dda2d407f8f461b1d32e8e014aa8c3ac1a04453483'],
    '013_anonymize_mood_responses': ['04a942affa4a00b6c8ae436d60c6843970ba650f7b3cb1a89857b8d03bd1537f'],
    '014_personal_reminders': ['7402dbb8fabadb4e4acf8eed97ff7246a7c4639ec9eadc8ba8dc61c0cb9937c5']
}));

const checksumFor = (migration) => {
    const source = `${migration.version}\n${migration.up.toString()}\n${migration.down?.toString() || ''}`;
    return crypto.createHash('sha256')
        .update(migration.checksumMaterial ? `${source}\n${migration.checksumMaterial}` : source)
        .digest('hex');
};

async function ensureMigrationTable(db, dialect) {
    if (dialect === 'postgres') {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                version TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                checksum CHAR(64)
            );
            ALTER TABLE schema_migrations
                ADD COLUMN IF NOT EXISTS checksum CHAR(64);
        `);
        return;
    }

    await db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT NOT NULL UNIQUE,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            checksum TEXT
        );
    `);
    const columns = await db.all('PRAGMA table_info(schema_migrations)');
    if (!columns.some(column => column.name === 'checksum')) {
        await db.exec('ALTER TABLE schema_migrations ADD COLUMN checksum TEXT;');
    }
}

const currentDialect = () => {
    if (process.env.DB_TYPE === 'postgres') return 'postgres';
    return 'sqlite';
};

async function runMigrations(db) {
    const dialect = currentDialect();
    await ensureMigrationTable(db, dialect);

    await db.transaction(async (tx) => {
        if (dialect === 'postgres') {
            await tx.exec("SELECT pg_advisory_xact_lock(hashtext('ikbenimle-schema-migrations'));");
        }

        for (const migration of MIGRATIONS) {
            const checksum = checksumFor(migration);
            const applied = await tx.get(
                'SELECT version, checksum FROM schema_migrations WHERE version = ?',
                [migration.version]
            );
            if (applied) {
                if (applied.checksum && applied.checksum !== checksum) {
                    const previousChecksums = PREVIOUS_CHECKSUMS.get(migration.version) || [];
                    if (!previousChecksums.includes(applied.checksum)) {
                        throw new Error(`MIGRATION_CHECKSUM_MISMATCH: ${migration.version}`);
                    }
                }
                if (applied.checksum !== checksum) {
                    await tx.run(
                        'UPDATE schema_migrations SET checksum = ? WHERE version = ?',
                        [checksum, migration.version]
                    );
                }
                continue;
            }
            await migration.up(tx, dialect);
            await tx.run(
                'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
                [migration.version, checksum]
            );
            console.log(`Migration applied: ${migration.version}`);
        }
    });
}

async function migrationStatus(db, { ensure = true } = {}) {
    const dialect = currentDialect();
    if (ensure) await ensureMigrationTable(db, dialect);
    const applied = await db.all(
        'SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version'
    );
    const appliedMap = new Map(applied.map(item => [item.version, item]));
    return MIGRATIONS.map(migration => ({
        version: migration.version,
        checksum: checksumFor(migration),
        applied: appliedMap.has(migration.version),
        applied_at: appliedMap.get(migration.version)?.applied_at || null
    }));
}

async function assertNoPendingMigrations(db) {
    const status = await migrationStatus(db, { ensure: false });
    const pending = status.filter(item => !item.applied);
    if (pending.length) {
        throw new Error(`PENDING_MIGRATIONS: ${pending.map(item => item.version).join(', ')}`);
    }
    return status;
}

async function rollbackMigrations(db, steps = 1) {
    if (process.env.ALLOW_DESTRUCTIVE_MIGRATION !== 'true') {
        throw new Error('DESTRUCTIVE_MIGRATION_DISABLED');
    }
    const dialect = currentDialect();
    await ensureMigrationTable(db, dialect);
    const applied = await db.all('SELECT version FROM schema_migrations ORDER BY version DESC');
    const targets = applied.slice(0, Math.max(1, Number(steps) || 1));
    for (const row of targets) {
        const migration = MIGRATIONS.find(item => item.version === row.version);
        if (!migration?.down) throw new Error(`MIGRATION_DOWN_UNAVAILABLE: ${row.version}`);
        await db.transaction(async tx => {
            await migration.down(tx, dialect);
            await tx.run('DELETE FROM schema_migrations WHERE version = ?', [row.version]);
        });
    }
}

module.exports = {
    MIGRATIONS,
    runMigrations,
    migrationStatus,
    assertNoPendingMigrations,
    rollbackMigrations
};
