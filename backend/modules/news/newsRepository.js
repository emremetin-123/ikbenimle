const SORT_COLUMNS = {
    created_at: 'n.created_at',
    title: 'n.title'
};

function createNewsRepository(db) {
    return {
        async list({ query, pagination }) {
            const clauses = [];
            const params = [];
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push('(n.title LIKE ? OR n.content LIKE ? OR u.name LIKE ?)');
                params.push(pattern, pattern, pattern);
            }
            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const sortColumn = SORT_COLUMNS[query.sort] || SORT_COLUMNS.created_at;
            const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
            const joins = `
                FROM company_news n
                LEFT JOIN users u ON n.created_by = u.id
                ${whereSql}
            `;
            const total = await db.get(`SELECT COUNT(*) AS total ${joins}`, params);
            const items = await db.all(`
                WITH ranked_news AS (
                    SELECT
                        n.id, n.title, n.content, n.image_url, n.image_public_id,
                        n.created_at, n.created_by, u.name AS author_name,
                        ROW_NUMBER() OVER (
                            ORDER BY ${sortColumn} ${sortDirection}, n.id DESC
                        ) AS row_num
                    ${joins}
                )
                SELECT id, title, content, image_url, created_at, created_by, author_name
                FROM ranked_news
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return { items, total: total?.total || 0 };
        },
        findById(id) {
            return db.get(`
                SELECT n.*, u.name AS author_name
                FROM company_news n
                LEFT JOIN users u ON n.created_by = u.id
                WHERE n.id = ?
            `, [id]);
        },
        create({ title, content, imageUrl, imagePublicId, createdBy }) {
            return db.run(
                'INSERT INTO company_news (title, content, image_url, image_public_id, created_by) VALUES (?, ?, ?, ?, ?)',
                [title, content, imageUrl, imagePublicId, createdBy]
            );
        },
        async remove(id) {
            const row = await db.get(
                'SELECT image_url, image_public_id FROM company_news WHERE id = ?',
                [id]
            );
            const result = await db.run('DELETE FROM company_news WHERE id = ?', [id]);
            return { row, changes: result.changes };
        }
    };
}

module.exports = { createNewsRepository };
