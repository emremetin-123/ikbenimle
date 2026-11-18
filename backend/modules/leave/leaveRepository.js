const LEAVE_OUTPUT_COLUMNS = `
    id, user_id, leave_type, requester_name, start_date, end_date,
    start_datetime, end_datetime, return_datetime, duration_type,
    duration_value, description, status, created_at, actioned_at
`;

const USER_SORT_COLUMNS = {
    created_at: 'l.created_at',
    start_datetime: 'l.start_datetime'
};

const ADMIN_SORT_COLUMNS = {
    ...USER_SORT_COLUMNS,
    requester_name: 'u.name'
};

const createLeaveRepository = db => ({
    create(data) {
        return db.run(`
            INSERT INTO leave_requests (
                user_id, leave_type, requester_name, start_date, end_date,
                start_datetime, end_datetime, return_datetime,
                duration_type, duration_value, reason, description, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.userId,
            data.leaveType,
            data.requesterName,
            data.startDate,
            data.endDate,
            data.startDateTime,
            data.endDateTime,
            data.returnDateTime,
            data.durationType,
            data.durationValue,
            data.leaveType,
            data.description,
            data.status
        ]);
    },

    async listUser(userId, query, pagination) {
        const clauses = ['l.user_id = ?'];
        const params = [userId];
        if (query.status) {
            clauses.push('l.status = ?');
            params.push(query.status);
        }
        const whereSql = `WHERE ${clauses.join(' AND ')}`;
        const sortColumn = USER_SORT_COLUMNS[query.sort] || USER_SORT_COLUMNS.created_at;
        const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
        const total = await db.get(
            `SELECT COUNT(*) AS total FROM leave_requests l ${whereSql}`,
            params
        );
        const items = await db.all(`
            WITH ranked_requests AS (
                SELECT
                    l.id, l.user_id, l.leave_type, l.requester_name,
                    l.start_date, l.end_date, l.start_datetime, l.end_datetime,
                    l.return_datetime, l.duration_type, l.duration_value,
                    l.description, l.status, l.created_at, l.actioned_at,
                    ROW_NUMBER() OVER (
                        ORDER BY ${sortColumn} ${sortDirection}, l.id DESC
                    ) AS row_num
                FROM leave_requests l
                ${whereSql}
            )
            SELECT ${LEAVE_OUTPUT_COLUMNS}
            FROM ranked_requests
            WHERE row_num BETWEEN ? AND ?
            ORDER BY row_num
        `, [...params, pagination.startRow, pagination.endRow]);
        return { items, total: total?.total };
    },

    async listAll(query, pagination) {
        const clauses = [];
        const params = [];
        if (query.status) {
            clauses.push('l.status = ?');
            params.push(query.status);
        }
        if (query.department) {
            clauses.push('u.department = ?');
            params.push(query.department);
        }
        if (query.search) {
            const pattern = `%${query.search}%`;
            clauses.push('(u.name LIKE ? OR u.employee_id LIKE ? OR l.leave_type LIKE ?)');
            params.push(pattern, pattern, pattern);
        }
        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const sortColumn = ADMIN_SORT_COLUMNS[query.sort] || ADMIN_SORT_COLUMNS.created_at;
        const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
        const total = await db.get(`
            SELECT COUNT(*) AS total
            FROM leave_requests l
            JOIN users u ON u.id = l.user_id
            ${whereSql}
        `, params);
        const items = await db.all(`
            WITH ranked_requests AS (
                SELECT
                    l.id, l.user_id, l.leave_type,
                    COALESCE(l.requester_name, u.name) AS requester_name,
                    l.start_date, l.end_date, l.start_datetime, l.end_datetime,
                    l.return_datetime, l.duration_type, l.duration_value,
                    l.description, l.status, l.created_at, l.actioned_at,
                    u.employee_id, u.department, u.position,
                    ROW_NUMBER() OVER (
                        ORDER BY ${sortColumn} ${sortDirection}, l.id DESC
                    ) AS row_num
                FROM leave_requests l
                JOIN users u ON u.id = l.user_id
                ${whereSql}
            )
            SELECT
                ${LEAVE_OUTPUT_COLUMNS}, employee_id, department, position
            FROM ranked_requests
            WHERE row_num BETWEEN ? AND ?
            ORDER BY row_num
        `, [...params, pagination.startRow, pagination.endRow]);
        return { items, total: total?.total };
    },

    updateStatus(id, status, actionedBy) {
        return db.run(
            `UPDATE leave_requests
             SET status = ?, actioned_by = ?, actioned_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, actionedBy, id]
        );
    },

    findForIntegration(id) {
        return db.get(`
            SELECT l.*, u.employee_id, u.name AS user_name
            FROM leave_requests l
            JOIN users u ON u.id = l.user_id
            WHERE l.id = ?
        `, [id]);
    }
});

module.exports = { createLeaveRepository };
