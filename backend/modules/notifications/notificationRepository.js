const { parsePagination } = require('../../core/pagination');

const fold = expression => [['İ', 'i'], ['ı', 'i'], ['Ç', 'c'], ['ç', 'c'], ['Ğ', 'g'], ['ğ', 'g'], ['Ö', 'o'], ['ö', 'o'], ['Ş', 's'], ['ş', 's'], ['Ü', 'u'], ['ü', 'u']]
    .reduce((sql, [letter, replacement]) => `REPLACE(${sql}, '${letter}', '${replacement}')`, `LOWER(${expression})`);

const routineColumns = `
    id, title, body, url, target, department, schedule_type,
    scheduled_date, scheduled_time, is_active, last_sent_key,
    created_by, created_at, updated_at
`;
const normalizeRoutine = row => ({
    ...row,
    is_active: row.is_active === true || row.is_active === 1 || row.is_active === '1'
});

function createNotificationRepository(db) {
    return {
        deactivateSubscription(userId, endpoint) {
            return db.run(
                `UPDATE push_subscriptions
                 SET is_active = 0
                 WHERE user_id = ? AND endpoint = ?`,
                [userId, endpoint]
            );
        },
        async getStats() {
            const [stats, departments] = await Promise.all([
                db.get(`
                    SELECT COUNT(*) AS total,
                           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
                    FROM push_subscriptions
                `),
                db.all(`
                    SELECT department, COUNT(*) AS count
                    FROM users
                    WHERE status = 'active'
                      AND department IS NOT NULL AND department <> ''
                    GROUP BY department
                    ORDER BY department
                `)
            ]);
            return {
                total: Number(stats?.total || 0),
                active: Number(stats?.active || 0),
                departments: departments.map(item => ({
                    department: item.department,
                    count: Number(item.count || 0)
                }))
            };
        },
        async listSubscriptions(query) {
            const pagination = parsePagination(query);
            const clauses = [];
            const params = [];
            if (query.status !== 'all') { clauses.push('s.is_active = ?'); params.push(query.status === 'active' ? 1 : 0); }
            if (query.search) {
                const pattern = '%' + query.search.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ı/g, 'i').replace(/[\\%_]/g, '\\$&') + '%';
                clauses.push(`(${fold('u.name')} LIKE ? ESCAPE '\\' OR ${fold('u.employee_id')} LIKE ? ESCAPE '\\' OR ${fold('u.department')} LIKE ? ESCAPE '\\')`);
                params.push(pattern, pattern, pattern);
            }
            const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
            const join = 'FROM push_subscriptions s LEFT JOIN users u ON u.id = s.user_id';
            const [count, rows] = await Promise.all([
                db.get(`SELECT COUNT(*) AS total ${join} ${where}`, params),
                db.all(`SELECT s.id, s.user_id, u.name, u.employee_id, u.department, u.status AS user_status,
                    s.device_label, s.is_active, s.created_at, s.updated_at ${join} ${where}
                    ORDER BY s.is_active DESC, s.updated_at DESC, s.id DESC LIMIT ? OFFSET ?`,
                [...params, pagination.pageSize, pagination.startRow - 1])
            ]);
            return { items: rows.map(row => ({ ...row, is_active: row.is_active === 1 || row.is_active === true })), total: count.total, pagination };
        },
        async findRoutine(id) {
            const row = await db.get(
                `SELECT ${routineColumns} FROM notification_routines WHERE id = ?`,
                [id]
            );
            return row ? normalizeRoutine(row) : null;
        },
        async listRoutines(query) {
            const pagination = parsePagination(query);
            const clauses = [];
            const params = [];
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push('(title LIKE ? OR body LIKE ? OR department LIKE ?)');
                params.push(pattern, pattern, pattern);
            }
            if (query.status === 'active') clauses.push('is_active = 1');
            if (query.status === 'passive') clauses.push('COALESCE(is_active, 0) = 0');
            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const sortColumns = {
                scheduled_time: 'scheduled_time',
                title: 'title',
                created_at: 'created_at'
            };
            const sortColumn = sortColumns[query.sort] || sortColumns.scheduled_time;
            const direction = query.order === 'desc' ? 'DESC' : 'ASC';
            const [count, rows] = await Promise.all([
                db.get(
                    `SELECT COUNT(*) AS total FROM notification_routines ${whereSql}`,
                    params
                ),
                db.all(`
                    WITH ranked_routines AS (
                        SELECT ${routineColumns},
                               ROW_NUMBER() OVER (
                                   ORDER BY ${sortColumn} ${direction}, id DESC
                               ) AS row_num
                        FROM notification_routines ${whereSql}
                    )
                    SELECT ${routineColumns}
                    FROM ranked_routines
                    WHERE row_num BETWEEN ? AND ?
                    ORDER BY row_num
                `, [...params, pagination.startRow, pagination.endRow])
            ]);
            return {
                items: rows.map(normalizeRoutine),
                total: Number(count?.total || 0),
                pagination
            };
        },
        async createRoutine(payload, userId) {
            const result = await db.run(`
                INSERT INTO notification_routines (
                    title, body, url, target, department, schedule_type,
                    scheduled_date, scheduled_time, is_active, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                payload.title, payload.body, payload.url, payload.target,
                payload.target === 'department' ? payload.department : null,
                payload.schedule_type,
                payload.schedule_type === 'once' ? payload.scheduled_date : null,
                payload.scheduled_time, payload.is_active ? 1 : 0, userId
            ]);
            return result.lastID;
        },
        updateRoutine(id, payload) {
            return db.run(`
                UPDATE notification_routines
                SET title = ?, body = ?, url = ?, target = ?, department = ?,
                    schedule_type = ?, scheduled_date = ?, scheduled_time = ?,
                    is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                payload.title, payload.body, payload.url, payload.target,
                payload.target === 'department' ? payload.department : null,
                payload.schedule_type,
                payload.schedule_type === 'once' ? payload.scheduled_date : null,
                payload.scheduled_time, payload.is_active ? 1 : 0, id
            ]);
        },
        deleteRoutine(id) {
            return db.run('DELETE FROM notification_routines WHERE id = ?', [id]);
        }
    };
}

module.exports = { createNotificationRepository };
