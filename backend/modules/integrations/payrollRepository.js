const createPayrollRepository = db => ({
    transaction: callback => db.transaction(callback),
    lock: (tx, id) => tx.run('UPDATE integration_connections SET id = id WHERE id = ?', [id]),
    employee: (tx, connectionId, externalId) => tx.get(
        'SELECT user_id FROM integration_employee_mappings WHERE connection_id = ? AND external_employee_id = ?',
        [connectionId, externalId]
    ),
    existing: (tx, connectionId, externalId) => tx.get(`
        SELECT p.*, d.file_path, d.storage_provider, d.storage_key
        FROM integration_payrolls p JOIN documents d ON d.id = p.document_id
        WHERE p.connection_id = ? AND p.external_payroll_id = ?`, [connectionId, externalId]),
    period: (tx, connectionId, userId, period) => tx.get(
        'SELECT id FROM integration_payrolls WHERE connection_id = ? AND user_id = ? AND period = ?',
        [connectionId, userId, period]
    ),
    async create(tx, data, stored) {
        const document = await tx.run(`INSERT INTO documents
            (user_id, title, file_path, uploaded_by_admin_id, storage_provider, storage_key)
            VALUES (?, ?, ?, ?, ?, ?)`,
        [data.userId, `${data.period} Bordrosu`, stored.filePath, null, stored.provider, stored.storageKey]);
        await tx.run(`INSERT INTO integration_payrolls
            (connection_id, external_payroll_id, user_id, period, revision, content_hash, document_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.connectionId, data.external_payroll_id, data.userId, data.period, data.revision, data.hash, document.lastID]);
        return Number(document.lastID);
    },
    async replace(tx, previous, data, stored) {
        await tx.run(`UPDATE documents SET file_path = ?, storage_provider = ?, storage_key = ?,
            upload_date = CURRENT_TIMESTAMP WHERE id = ?`,
        [stored.filePath, stored.provider, stored.storageKey, previous.document_id]);
        await tx.run(`UPDATE integration_payrolls SET revision = ?, content_hash = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [data.revision, data.hash, previous.id]);
        return Number(previous.document_id);
    }
});
module.exports = { createPayrollRepository };
