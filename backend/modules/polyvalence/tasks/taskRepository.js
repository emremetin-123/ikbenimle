const createTaskRepository = (db) => ({
    listLevels: () => db.all(
        'SELECT level_value, label, description FROM polyvalence_level_definitions ORDER BY level_value'
    ),
    getTask: (taskId) => db.get(
        `SELECT t.*, p.status AS period_status, p.name AS period_name, p.department_id,
                p.due_date, d.name AS department_name
         FROM polyvalence_review_tasks t
         JOIN polyvalence_periods p ON p.id = t.period_id
         JOIN polyvalence_departments d ON d.id = p.department_id
         WHERE t.id = ?`,
        [taskId]
    ),
    listTaskAssessments: (task) => db.all(
        `SELECT a.id AS assessment_id, a.level_value, a.can_train, a.note, a.target_level_snapshot,
                a.version_no, a.updated_at,
                pm.id AS period_member_id, pm.user_id, pm.employee_id_snapshot, pm.employee_name_snapshot,
                pm.position_snapshot,
                ps.id AS period_skill_id, ps.skill_id, ps.skill_code_snapshot, ps.skill_name_snapshot,
                ps.category_name_snapshot, ps.sort_order_snapshot
         FROM polyvalence_assessments a
         JOIN polyvalence_period_members pm ON pm.id = a.period_member_id
         JOIN polyvalence_period_skills ps ON ps.id = a.period_skill_id
         WHERE a.period_id = ? AND pm.evaluator_user_id = ? AND COALESCE(pm.is_excluded, 0) = 0
         ORDER BY pm.employee_name_snapshot, ps.sort_order_snapshot, ps.skill_name_snapshot`,
        [task.period_id, task.evaluator_user_id]
    ),
    getAssessment: (assessmentId, task) => db.get(
        `SELECT a.*, pm.evaluator_user_id
         FROM polyvalence_assessments a
         JOIN polyvalence_period_members pm ON pm.id = a.period_member_id
         WHERE a.id = ? AND a.period_id = ? AND pm.evaluator_user_id = ?`,
        [assessmentId, task.period_id, task.evaluator_user_id]
    ),
    updateAssessment: (assessmentId, expectedVersion, data) => db.run(
        `UPDATE polyvalence_assessments
         SET level_value = ?, can_train = ?, note = ?, updated_by = ?, version_no = version_no + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND version_no = ?`,
        [data.level, data.canTrain ? 1 : 0, data.note || null, data.userId, assessmentId, expectedVersion]
    ),
    getAssessmentResult: (assessmentId) => db.get(
        `SELECT id, period_id, period_member_id, period_skill_id, level_value, can_train,
                note, updated_by, version_no, updated_at
         FROM polyvalence_assessments WHERE id = ?`,
        [assessmentId]
    ),
    markTaskInProgress: (taskId) => db.run(
        `UPDATE polyvalence_review_tasks
         SET status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
             updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [taskId]
    ),
    countMissingAssessments: (task) => db.get(
        `SELECT COUNT(*) AS count
         FROM polyvalence_assessments a
         JOIN polyvalence_period_members pm ON pm.id = a.period_member_id
         WHERE a.period_id = ? AND pm.evaluator_user_id = ?
           AND COALESCE(pm.is_excluded, 0) = 0 AND a.level_value IS NULL`,
        [task.period_id, task.evaluator_user_id]
    ),
    completeTask: (taskId) => db.run(
        `UPDATE polyvalence_review_tasks
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [taskId]
    ),
    insertAudit: (req, data) => db.run(
        `INSERT INTO polyvalence_audit_logs
         (entity_type, entity_id, action, old_value, new_value, reason, actor_user_id, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.entityType,
            data.entityId,
            data.action,
            data.oldValue == null ? null : JSON.stringify(data.oldValue),
            data.newValue == null ? null : JSON.stringify(data.newValue),
            data.reason || null,
            req.user?.id || null,
            req.ip || null,
            req.headers['user-agent'] || null
        ]
    )
});

module.exports = { createTaskRepository };
