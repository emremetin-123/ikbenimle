const addColumnIfMissing = async (db, dialect, table, column, definition) => {
    if (dialect === 'postgres') {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition};`);
        return;
    }
    const columns = await db.all(`PRAGMA table_info(${table})`);
    if (!columns.some(item => item.name === column)) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    }
};

module.exports = [
    {
        version: '019_upload_storage_metadata',
        async up(db, dialect) {
            await addColumnIfMissing(db, dialect, 'feedback', 'details', 'TEXT');
            await addColumnIfMissing(db, dialect, 'feedback', 'file_path', 'TEXT');
            await addColumnIfMissing(db, dialect, 'feedback', 'storage_provider', 'TEXT');
            await addColumnIfMissing(db, dialect, 'feedback', 'storage_key', 'TEXT');
            await addColumnIfMissing(db, dialect, 'documents', 'storage_provider', 'TEXT');
            await addColumnIfMissing(db, dialect, 'documents', 'storage_key', 'TEXT');
            await addColumnIfMissing(db, dialect, 'document_requests', 'response_storage_provider', 'TEXT');
            await addColumnIfMissing(db, dialect, 'document_requests', 'response_storage_key', 'TEXT');
        },
        async down(db) {
            await db.exec(`
                ALTER TABLE document_requests DROP COLUMN response_storage_key;
                ALTER TABLE document_requests DROP COLUMN response_storage_provider;
                ALTER TABLE documents DROP COLUMN storage_key;
                ALTER TABLE documents DROP COLUMN storage_provider;
                ALTER TABLE feedback DROP COLUMN storage_key;
                ALTER TABLE feedback DROP COLUMN storage_provider;
            `);
        }
    }
];
