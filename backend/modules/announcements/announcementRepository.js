const SORT_COLUMNS = {
    created_at: 'a.created_at',
    visible_until: 'a.visible_until',
    title: 'a.title'
};

function createAnnouncementRepository(db) {
    const searchFilter = (query) => {
        const clauses = [];
        const params = [];
        if (query.search) {
            const pattern = `%${query.search}%`;
            clauses.push('(a.title LIKE ? OR a.content LIKE ? OR u.name LIKE ?)');
            params.push(pattern, pattern, pattern);
        }
        return { clauses, params };
    };

    return {
        findUserDepartment(userId) {
            return db.get('SELECT department FROM users WHERE id = ?', [userId]);
        },
        async listAdmin({ query, pagination }) {
            const { clauses, params } = searchFilter(query);
            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const sortColumn = SORT_COLUMNS[query.sort] || SORT_COLUMNS.created_at;
            const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
            const joins = `
                FROM announcements a
                LEFT JOIN users u ON a.created_by = u.id
                ${whereSql}
            `;
            const total = await db.get(`SELECT COUNT(*) AS total ${joins}`, params);
            const items = await db.all(`
                WITH ranked_announcements AS (
                    SELECT
                        a.id, a.title, a.content, a.attachment_path,
                        a.attachment_name, a.attachment_type, a.attachment_public_id,
                        a.target_department, a.visible_until, a.created_at, a.created_by,
                        u.name AS author_name,
                        ROW_NUMBER() OVER (
                            ORDER BY ${sortColumn} ${sortDirection}, a.id DESC
                        ) AS row_num
                    ${joins}
                )
                SELECT
                    id, title, content, attachment_path, attachment_name,
                    attachment_type, attachment_public_id, target_department,
                    visible_until, created_at, created_by, author_name
                FROM ranked_announcements
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return { items, total: total?.total || 0 };
        },
        listVisibleCandidates(query, today) {
            const { clauses, params } = searchFilter(query);
            clauses.unshift('a.visible_until IS NOT NULL', 'a.visible_until >= ?');
            params.unshift(today);
            const sortColumn = SORT_COLUMNS[query.sort] || SORT_COLUMNS.created_at;
            const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
            return db.all(`
                SELECT
                    a.id, a.title, a.content, a.attachment_path, a.attachment_name,
                    a.attachment_type, a.target_department, a.visible_until,
                    a.created_at, a.created_by, u.name AS author_name
                FROM announcements a
                LEFT JOIN users u ON a.created_by = u.id
                WHERE ${clauses.join(' AND ')}
                ORDER BY ${sortColumn} ${sortDirection}, a.id DESC
            `, params);
        },
        listDepartments() {
            return db.all(`
                SELECT DISTINCT department
                FROM users
                WHERE department IS NOT NULL
                  AND department <> ''
                  AND COALESCE(status, ?) = ?
                ORDER BY department ASC
            `, ['active', 'active']);
        },
        create(data) {
            return db.run(`
                INSERT INTO announcements (
                    title, content, attachment_path, attachment_name,
                    attachment_type, attachment_public_id, target_department,
                    visible_until, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.title,
                data.content,
                data.attachmentPath,
                data.attachmentName,
                data.attachmentType,
                data.attachmentPublicId,
                data.targetDepartment,
                data.visibleUntil,
                data.createdBy
            ]);
        },
        async remove(id) {
            const row = await db.get(`
                SELECT attachment_path, attachment_public_id, attachment_type
                FROM announcements
                WHERE id = ?
            `, [id]);
            const result = await db.run('DELETE FROM announcements WHERE id = ?', [id]);
            return { row, changes: result.changes };
        }
    };
}

module.exports = { createAnnouncementRepository };
