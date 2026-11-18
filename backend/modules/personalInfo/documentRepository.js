const createDocumentRepository = db => ({
    getRequestTypes: async (activeOnly = false) => {
        const types = await db.all(
            `SELECT * FROM document_request_types
             ${activeOnly ? 'WHERE COALESCE(is_active, 1) = 1' : ''}
             ORDER BY order_index, name`
        );
        const fields = await db.all(
            'SELECT * FROM document_request_fields ORDER BY order_index, id'
        );
        return { types, fields };
    },
    countDocuments: userId => db.get(
        'SELECT COUNT(*) AS total FROM documents WHERE user_id = ?',
        [userId]
    ),
    listDocuments: (userId, pagination, sortColumn, sortDirection) => db.all(
        `WITH ranked_documents AS (
            SELECT id, title, file_path, upload_date,
                   ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, id DESC) AS row_num
            FROM documents WHERE user_id = ?
         )
         SELECT id, title, file_path, upload_date
         FROM ranked_documents WHERE row_num BETWEEN ? AND ? ORDER BY row_num`,
        [userId, pagination.startRow, pagination.endRow]
    ),
    listUserOptions: async ({ search, pagination }) => {
        const params = [];
        const clauses = ["COALESCE(status, 'active') = 'active'"];
        if (search) {
            const pattern = `%${search}%`;
            clauses.push('(name LIKE ? OR employee_id LIKE ? OR department LIKE ? OR position LIKE ?)');
            params.push(pattern, pattern, pattern, pattern);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;
        const total = await db.get(`SELECT COUNT(*) AS total FROM users ${where}`, params);
        const rows = await db.all(
            `WITH ranked_options AS (
                SELECT id, employee_id, name, department, position, status,
                       ROW_NUMBER() OVER (ORDER BY name, employee_id, id) AS row_num
                FROM users ${where}
             )
             SELECT id, employee_id, name, department, position, status
             FROM ranked_options WHERE row_num BETWEEN ? AND ? ORDER BY row_num`,
            [...params, pagination.startRow, pagination.endRow]
        );
        return { total: total?.total, rows };
    },
    createRequestType: data => db.transaction(async (tx) => {
        const result = await tx.run(
            `INSERT INTO document_request_types (name, description, is_active, order_index)
             VALUES (?, ?, ?, ?)`,
            [data.name, data.description, data.isActive ? 1 : 0, data.orderIndex]
        );
        for (const field of data.fields) {
            await tx.run(
                `INSERT INTO document_request_fields
                 (type_id, label, field_key, field_type, is_required, order_index, placeholder)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [result.lastID, field.label, field.key, field.type, field.isRequired ? 1 : 0, field.orderIndex, field.placeholder]
            );
        }
        return result.lastID;
    }),
    updateRequestType: (id, data) => db.transaction(async (tx) => {
        await tx.run(
            `UPDATE document_request_types
             SET name = ?, description = ?, is_active = ?, order_index = ?,
                 updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [data.name, data.description, data.isActive ? 1 : 0, data.orderIndex, id]
        );
        await tx.run('DELETE FROM document_request_fields WHERE type_id = ?', [id]);
        for (const field of data.fields) {
            await tx.run(
                `INSERT INTO document_request_fields
                 (type_id, label, field_key, field_type, is_required, order_index, placeholder)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, field.label, field.key, field.type, field.isRequired ? 1 : 0, field.orderIndex, field.placeholder]
            );
        }
    }),
    countEmployeeRequests: userId => db.get(
        'SELECT COUNT(*) AS total FROM document_requests WHERE user_id = ?',
        [userId]
    ),
    listEmployeeRequests: (userId, pagination, sortColumn, sortDirection) => db.all(
        `WITH ranked_requests AS (
            SELECT r.id, r.user_id, r.type_id, r.status, r.answers_json, r.hr_note,
                   r.response_file_path, r.response_file_name, r.response_uploaded_at,
                   r.created_at, r.updated_at, t.name AS type_name,
                   ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, r.id DESC) AS row_num
            FROM document_requests r
            JOIN document_request_types t ON r.type_id = t.id
            WHERE r.user_id = ?
         )
         SELECT id, user_id, type_id, status, answers_json, hr_note,
                response_file_path, response_file_name, response_uploaded_at,
                created_at, updated_at, type_name
         FROM ranked_requests WHERE row_num BETWEEN ? AND ? ORDER BY row_num`,
        [userId, pagination.startRow, pagination.endRow]
    ),
    getRequestType: typeId => db.get(
        'SELECT id, is_active FROM document_request_types WHERE id = ?',
        [typeId]
    ),
    getRequestFields: typeId => db.all(
        'SELECT * FROM document_request_fields WHERE type_id = ? ORDER BY order_index',
        [typeId]
    ),
    createDocumentRequest: async ({ userId, typeId, answers }) => (
        await db.run(
            `INSERT INTO document_requests (user_id, type_id, status, answers_json)
             VALUES (?, ?, ?, ?)`,
            [userId, typeId, 'Beklemede', JSON.stringify(answers)]
        )
    ).lastID,
    listAdminRequests: async ({ query, pagination, sortColumn, sortDirection }) => {
        const clauses = [];
        const params = [];
        if (query.search) {
            const pattern = `%${query.search}%`;
            clauses.push('(u.name LIKE ? OR u.employee_id LIKE ? OR u.department LIKE ? OR t.name LIKE ?)');
            params.push(pattern, pattern, pattern, pattern);
        }
        if (query.status) { clauses.push('r.status = ?'); params.push(query.status); }
        if (query.type) { clauses.push('r.type_id = ?'); params.push(query.type); }
        if (query.start) { clauses.push('r.created_at >= ?'); params.push(`${query.start} 00:00:00`); }
        if (query.end) { clauses.push('r.created_at <= ?'); params.push(`${query.end} 23:59:59`); }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const joins = `FROM document_requests r
            JOIN document_request_types t ON r.type_id = t.id
            JOIN users u ON r.user_id = u.id
            LEFT JOIN users a ON r.handled_by_admin_id = a.id ${where}`;
        const total = await db.get(`SELECT COUNT(*) AS total ${joins}`, params);
        const rows = await db.all(
            `WITH ranked_requests AS (
                SELECT r.id, r.user_id, r.type_id, r.status, r.answers_json, r.hr_note,
                       r.response_file_path, r.response_file_name, r.response_uploaded_at,
                       r.created_at, r.updated_at, r.handled_by_admin_id,
                       t.name AS type_name, u.name AS user_name, u.employee_id,
                       u.department, u.position, a.name AS handled_by_name,
                       ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, r.id DESC) AS row_num
                ${joins}
             )
             SELECT id, user_id, type_id, status, answers_json, hr_note,
                    response_file_path, response_file_name, response_uploaded_at,
                    created_at, updated_at, handled_by_admin_id, type_name, user_name,
                    employee_id, department, position, handled_by_name
             FROM ranked_requests WHERE row_num BETWEEN ? AND ? ORDER BY row_num`,
            [...params, pagination.startRow, pagination.endRow]
        );
        return { total: total?.total, rows };
    },
    updateRequestStatus: (id, { status, hrNote, adminId }) => db.run(
        `UPDATE document_requests
         SET status = ?, hr_note = ?, handled_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, hrNote, adminId, id]
    ),
    insertDocument: data => db.run(
        `INSERT INTO documents
         (user_id, title, file_path, uploaded_by_admin_id, storage_provider, storage_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.userId, data.title, data.filePath, data.adminId, data.provider, data.storageKey]
    ),
    getDocumentFile: id => db.get(
        'SELECT file_path, storage_provider, storage_key FROM documents WHERE id = ?',
        [id]
    ),
    deleteDocument: id => db.run('DELETE FROM documents WHERE id = ?', [id]),
    getRequestResponseFile: id => db.get(
        `SELECT response_file_path, response_storage_provider, response_storage_key
         FROM document_requests WHERE id = ?`,
        [id]
    ),
    updateRequestResponseFile: (id, data) => db.run(
        `UPDATE document_requests
         SET response_file_path = ?, response_file_name = ?, response_uploaded_at = CURRENT_TIMESTAMP,
             response_storage_provider = ?, response_storage_key = ?, status = 'Tamamlandı',
             handled_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [data.filePath, data.fileName, data.provider, data.storageKey, data.adminId, id]
    )
});

module.exports = { createDocumentRepository };
