const createPolyvalenceRepository = (db) => ({
    async hasReviewTasksForEvaluator(evaluatorUserId) {
        const task = await db.get(
            `SELECT t.id FROM polyvalence_review_tasks t
             JOIN polyvalence_periods p ON p.id = t.period_id
             JOIN polyvalence_departments d ON d.id = p.department_id
             WHERE t.evaluator_user_id = ? AND p.status = 'open'
             LIMIT 1`,
            [evaluatorUserId]
        );
        return Boolean(task);
    },
    async listReviewTasksForEvaluator(evaluatorUserId) {
        const tasks = await db.all(
            `SELECT t.id, t.period_id, t.status, t.completed_at, t.updated_at,
                    p.name AS period_name, p.start_date, p.end_date, p.due_date,
                    p.status AS period_status, d.name AS department_name,
                    COUNT(a.id) AS total,
                    SUM(CASE WHEN a.level_value IS NOT NULL THEN 1 ELSE 0 END) AS completed,
                    COUNT(DISTINCT pm.id) AS member_count
             FROM polyvalence_review_tasks t
             JOIN polyvalence_periods p ON p.id = t.period_id
             JOIN polyvalence_departments d ON d.id = p.department_id
             LEFT JOIN polyvalence_period_members pm
                ON pm.period_id = t.period_id
               AND pm.evaluator_user_id = t.evaluator_user_id
               AND COALESCE(pm.is_excluded, 0) = 0
             LEFT JOIN polyvalence_assessments a
                ON a.period_id = t.period_id
               AND a.period_member_id = pm.id
             WHERE t.evaluator_user_id = ? AND p.status = 'open'
             GROUP BY t.id, t.period_id, t.status, t.completed_at, t.updated_at,
                      p.name, p.start_date, p.end_date, p.due_date, p.status, d.name
             ORDER BY p.due_date, t.id DESC`,
            [evaluatorUserId]
        );
        return tasks.map(task => {
            const total = Number(task.total || 0);
            const completed = Number(task.completed || 0);
            return {
                ...task,
                total,
                completed,
                member_count: Number(task.member_count || 0),
                progress_percent: total ? Math.round((completed / total) * 100) : 0
            };
        });
    },

    listTaskSummaries(periodId) {
        return db.all(
            `SELECT t.id, t.period_id, t.evaluator_user_id, t.status, p.due_date,
                    t.completed_at, t.created_at, t.updated_at, u.name AS evaluator_name,
                    COUNT(DISTINCT pm.id) AS member_count,
                    COUNT(a.id) AS total,
                    SUM(CASE WHEN a.level_value IS NOT NULL THEN 1 ELSE 0 END) AS completed
             FROM polyvalence_review_tasks t
             JOIN polyvalence_periods p ON p.id = t.period_id
             JOIN users u ON u.id = t.evaluator_user_id
             LEFT JOIN polyvalence_period_members pm
                    ON pm.period_id = t.period_id
                   AND pm.evaluator_user_id = t.evaluator_user_id
                   AND COALESCE(pm.is_excluded, 0) = 0
             LEFT JOIN polyvalence_assessments a ON a.period_member_id = pm.id
             WHERE t.period_id = ?
             GROUP BY t.id, t.period_id, t.evaluator_user_id, t.status, p.due_date,
                      t.completed_at, t.created_at, t.updated_at, u.name
             ORDER BY u.name`,
            [periodId]
        );
    },

    listAuditLogs(periodId) {
        return db.all(
            `SELECT l.*, u.name AS actor_name
             FROM polyvalence_audit_logs l
             LEFT JOIN users u ON u.id = l.actor_user_id
             WHERE (l.entity_type = 'period' AND l.entity_id = ?)
                OR (
                    l.entity_type = 'assessment'
                    AND EXISTS (
                        SELECT 1
                        FROM polyvalence_assessments a
                        WHERE a.id = l.entity_id AND a.period_id = ?
                    )
                )
             ORDER BY l.created_at DESC`,
            [periodId, periodId]
        );
    },

    async existingAssignmentUserIds(videoId, userIds) {
        if (!userIds.length) return new Set();
        const placeholders = userIds.map(() => '?').join(',');
        const rows = await db.all(
            `SELECT user_id
             FROM assignments
             WHERE video_id = ?
               AND user_id IN (${placeholders})
               AND COALESCE(status, '') <> 'cancelled'`,
            [videoId, ...userIds]
        );
        return new Set(rows.map(row => Number(row.user_id)));
    }
});

module.exports = {
    createPolyvalenceRepository
};
