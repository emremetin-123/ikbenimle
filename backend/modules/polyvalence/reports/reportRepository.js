const placeholders = values => values.map(() => '?').join(',');

const createReportRepository = (db) => ({
    listPeriodGroups: (departmentId = null) => db.all(
        `SELECT p.id, p.department_id, p.name, p.start_date, p.end_date, p.due_date, p.status,
                d.name AS department_name,
                COALESCE(t.task_total, 0) AS task_total,
                COALESCE(t.task_completed, 0) AS task_completed
         FROM polyvalence_periods p
         JOIN polyvalence_departments d ON d.id = p.department_id
         LEFT JOIN (
             SELECT period_id, COUNT(*) AS task_total,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS task_completed
             FROM polyvalence_review_tasks GROUP BY period_id
         ) t ON t.period_id = p.id
         WHERE p.status <> 'cancelled'
           ${departmentId === null ? '' : 'AND p.department_id = ?'}
         ORDER BY p.start_date DESC, p.end_date DESC, d.name`,
        departmentId === null ? [] : [departmentId]
    ),
    listPeriodsForScope: (departmentId = null) => db.all(
        `SELECT p.*, d.name AS department_name
         FROM polyvalence_periods p
         JOIN polyvalence_departments d ON d.id = p.department_id
         WHERE p.status <> 'cancelled'
           ${departmentId === null ? '' : 'AND p.department_id = ?'}
         ORDER BY p.start_date DESC, p.end_date DESC, d.name`,
        departmentId === null ? [] : [departmentId]
    ),
    listDashboardRows: periodIds => db.all(
        `SELECT a.period_id, pm.id AS period_member_id, p.department_id, d.name AS department_name,
                pm.employee_id_snapshot, pm.employee_name_snapshot, pm.position_snapshot, pm.evaluator_user_id,
                pm.evaluator_name_snapshot, pm.role_name_snapshot, ps.skill_code_snapshot, ps.skill_name_snapshot,
                ps.category_name_snapshot, a.target_level_snapshot, a.criticality_snapshot,
                a.min_qualified_count_snapshot, a.level_value, a.can_train,
                a.note, a.updated_at, u.name AS updated_by_name
         FROM polyvalence_assessments a
         JOIN polyvalence_periods p ON p.id = a.period_id
         JOIN polyvalence_departments d ON d.id = p.department_id
         JOIN polyvalence_period_members pm ON pm.id = a.period_member_id
         JOIN polyvalence_period_skills ps ON ps.id = a.period_skill_id
         LEFT JOIN users u ON u.id = a.updated_by
         WHERE a.period_id IN (${placeholders(periodIds)}) AND COALESCE(pm.is_excluded, 0) = 0
         ORDER BY d.name, ps.sort_order_snapshot, ps.skill_name_snapshot, pm.employee_name_snapshot`,
        periodIds
    ),
    listPreviousRows: periodIds => db.all(
        `SELECT a.period_id, pm.id AS period_member_id, p.department_id, d.name AS department_name,
                pm.employee_id_snapshot, pm.employee_name_snapshot, pm.position_snapshot, pm.evaluator_user_id,
                pm.role_name_snapshot, ps.skill_name_snapshot, ps.category_name_snapshot,
                a.target_level_snapshot, a.criticality_snapshot, a.min_qualified_count_snapshot, a.level_value
         FROM polyvalence_assessments a
         JOIN polyvalence_periods p ON p.id = a.period_id
         JOIN polyvalence_departments d ON d.id = p.department_id
         JOIN polyvalence_period_members pm ON pm.id = a.period_member_id
         JOIN polyvalence_period_skills ps ON ps.id = a.period_skill_id
         WHERE a.period_id IN (${placeholders(periodIds)}) AND COALESCE(pm.is_excluded, 0) = 0`,
        periodIds
    ),
    listDashboardTasks: periodIds => db.all(
        `SELECT t.*, u.name AS evaluator_name, p.department_id, d.name AS department_name
         FROM polyvalence_review_tasks t
         JOIN polyvalence_periods p ON p.id = t.period_id
         JOIN polyvalence_departments d ON d.id = p.department_id
         JOIN users u ON u.id = t.evaluator_user_id
         WHERE t.period_id IN (${placeholders(periodIds)})
         ORDER BY d.name, u.name`,
        periodIds
    ),
    getPeriod: periodId => db.get(
        `SELECT p.*, d.name AS department_name FROM polyvalence_periods p
         JOIN polyvalence_departments d ON d.id = p.department_id WHERE p.id = ?`,
        [periodId]
    ),
    listPeriodRows: periodId => db.all(
        `SELECT pm.employee_id_snapshot, pm.employee_name_snapshot, pm.position_snapshot,
                pm.evaluator_name_snapshot, pm.role_name_snapshot, ps.skill_code_snapshot, ps.skill_name_snapshot,
                ps.category_name_snapshot, a.target_level_snapshot, a.criticality_snapshot,
                a.min_qualified_count_snapshot, a.level_value, a.can_train,
                a.note, a.updated_at, u.name AS updated_by_name
         FROM polyvalence_assessments a
         JOIN polyvalence_period_members pm ON pm.id = a.period_member_id
         JOIN polyvalence_period_skills ps ON ps.id = a.period_skill_id
         LEFT JOIN users u ON u.id = a.updated_by
         WHERE a.period_id = ? AND COALESCE(pm.is_excluded, 0) = 0
         ORDER BY ps.sort_order_snapshot, ps.skill_name_snapshot, pm.employee_name_snapshot`,
        [periodId]
    ),
    findSkillTraining: skillId => db.get(
        'SELECT video_id FROM polyvalence_skill_trainings WHERE skill_id = ? ORDER BY id',
        [skillId]
    )
});

module.exports = { createReportRepository };
