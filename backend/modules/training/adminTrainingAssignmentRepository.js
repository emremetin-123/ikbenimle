const { SUCCESSFUL_COMPLETION_SQL } = require('./trainingStatus');

const ASSIGNMENT_STATS_SQL = `
    SELECT
        a.id AS assignment_id,
        u.name, u.employee_id, u.department, u.position,
        v.title, v.category, v.pass_score,
        v.trainer_name, v.trainer_title, v.duration, v.validity_period,
        v.training_profile, v.delivery_method, v.is_mandatory, v.version_no,
        v.minimum_watch_percent, v.requires_full_watch, v.requires_quiz,
        a.status, a.quiz_score, a.due_date, a.assigned_at, a.completed_at,
        a.reference_id, a.confirmed_at,
        COALESCE(SUM(lp.watched_seconds), 0) AS watched_seconds,
        COALESCE(SUM(lp.quiz_attempts), 0) AS quiz_attempts,
        MAX(COALESCE(lp.requires_rewatch, 0)) AS requires_rewatch
    FROM assignments a
    JOIN users u ON a.user_id = u.id
    JOIN videos v ON a.video_id = v.id
    LEFT JOIN lesson_progress lp ON lp.assignment_id = a.id
    GROUP BY a.id, u.name, u.employee_id, u.department, u.position,
        v.title, v.category, v.pass_score, v.trainer_name, v.trainer_title,
        v.duration, v.validity_period, v.training_profile, v.delivery_method,
        v.is_mandatory, v.version_no, v.minimum_watch_percent,
        v.requires_full_watch, v.requires_quiz, a.status, a.quiz_score,
        a.due_date, a.assigned_at, a.completed_at, a.reference_id, a.confirmed_at
`;

const buildStatsFilter = filters => {
    const clauses = [];
    const params = [];
    if (filters.search) {
        const pattern = `%${filters.search}%`;
        clauses.push('(s.name LIKE ? OR s.employee_id LIKE ? OR s.title LIKE ? OR s.category LIKE ?)');
        params.push(pattern, pattern, pattern, pattern);
    }
    if (filters.department) {
        clauses.push('s.department = ?');
        params.push(filters.department);
    }
    if (filters.status === 'completed') clauses.push("s.status = 'completed'");
    if (filters.status === 'passed') clauses.push(`(${SUCCESSFUL_COMPLETION_SQL})`);
    if (filters.status === 'pending') clauses.push("s.status NOT IN ('completed', 'cancelled')");
    if (filters.status === 'expired') clauses.push("s.status NOT IN ('completed', 'cancelled') AND s.due_date IS NOT NULL AND s.due_date < CURRENT_TIMESTAMP");
    if (filters.status === 'assigned') clauses.push("(s.status NOT IN ('completed', 'cancelled') AND (s.due_date IS NULL OR s.due_date >= CURRENT_TIMESTAMP))");
    if (filters.status === 'cancelled') clauses.push("s.status = 'cancelled'");
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

const createAdminTrainingAssignmentRepository = db => ({
    async listStats(filters, pagination) {
        const { where, params } = buildStatsFilter(filters);
        const sortColumns = {
            assigned_at: 's.assigned_at', name: 's.name', title: 's.title',
            due_date: 's.due_date', completed_at: 's.completed_at'
        };
        const sortColumn = sortColumns[filters.sort] || sortColumns.assigned_at;
        const sortDirection = filters.order === 'asc' ? 'ASC' : 'DESC';
        const [summary, items] = await Promise.all([
            db.get(`
                WITH assignment_stats AS (${ASSIGNMENT_STATS_SQL})
                SELECT COUNT(*) AS total,
                    SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS completed,
                    SUM(CASE WHEN s.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                    SUM(CASE WHEN s.status NOT IN ('completed', 'cancelled') AND s.due_date IS NOT NULL AND s.due_date < CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS overdue,
                    SUM(CASE WHEN ${SUCCESSFUL_COMPLETION_SQL} THEN 1 ELSE 0 END) AS passed
                FROM assignment_stats s ${where}
            `, params),
            db.all(`
                WITH assignment_stats AS (${ASSIGNMENT_STATS_SQL}),
                ranked_stats AS (
                    SELECT s.*, ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, s.assignment_id DESC) AS row_num
                    FROM assignment_stats s ${where}
                )
                SELECT assignment_id, name, employee_id, department, position, title, category,
                    pass_score, trainer_name, trainer_title, duration, validity_period,
                    training_profile, delivery_method, is_mandatory, version_no,
                    minimum_watch_percent, requires_full_watch, requires_quiz, status,
                    quiz_score, due_date, assigned_at, completed_at, reference_id,
                    confirmed_at, watched_seconds, quiz_attempts, requires_rewatch
                FROM ranked_stats WHERE row_num BETWEEN ? AND ? ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow])
        ]);
        return { items, summary };
    },

    listStatsDepartments() {
        return db.all(`SELECT DISTINCT u.department FROM assignments a JOIN users u ON a.user_id = u.id WHERE u.department IS NOT NULL AND u.department <> '' ORDER BY u.department`);
    },

    listActiveDepartments() {
        return db.all(`SELECT DISTINCT department FROM users WHERE COALESCE(status, 'active') = 'active' AND department IS NOT NULL AND department <> '' ORDER BY department`);
    },

    listActivePositions() {
        return db.all(`SELECT DISTINCT position FROM users WHERE COALESCE(status, 'active') = 'active' AND position IS NOT NULL AND position <> '' ORDER BY position`);
    },

    async listUserOptions(filters, pagination) {
        const clauses = ["COALESCE(status, 'active') = 'active'"];
        const params = [];
        if (filters.search) {
            const pattern = `%${filters.search}%`;
            clauses.push('(name LIKE ? OR employee_id LIKE ? OR position LIKE ?)');
            params.push(pattern, pattern, pattern);
        }
        if (filters.department) {
            clauses.push('department = ?');
            params.push(filters.department);
        }
        if (filters.position) {
            clauses.push('position = ?');
            params.push(filters.position);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;
        const [total, items] = await Promise.all([
            db.get(`SELECT COUNT(*) AS total FROM users ${where}`, params),
            db.all(`
                WITH ranked_options AS (
                    SELECT id, employee_id, name, department, position, status,
                           ROW_NUMBER() OVER (ORDER BY name, employee_id, id) AS row_num
                    FROM users ${where}
                )
                SELECT id, employee_id, name, department, position, status
                FROM ranked_options WHERE row_num BETWEEN ? AND ? ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow])
        ]);
        return { items, total: total?.total };
    },

    cancelAssignment(assignmentId, userId) {
        return db.run(`
            UPDATE assignments SET status = 'cancelled', voided_at = CURRENT_TIMESTAMP,
                void_reason = COALESCE(void_reason, 'Admin tarafindan iptal edildi'), voided_by = ?
            WHERE id = ? AND status <> 'cancelled'
        `, [userId, assignmentId]);
    }
});

module.exports = { createAdminTrainingAssignmentRepository };
