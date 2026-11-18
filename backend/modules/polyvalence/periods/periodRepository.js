const periodColumns = `
    p.id, p.department_id, p.previous_period_id, p.name, p.start_date, p.end_date,
    p.due_date, p.status, p.opened_at, p.opened_by, p.closed_at, p.closed_by,
    p.cancelled_at, p.cancelled_by, p.cancellation_reason, p.created_at, p.updated_at
`;

const createPeriodRepository = (db) => ({
    transaction: (handler) => db.transaction(handler),

    getLevel: (level, conn = db) => conn.get(
        `SELECT level_value, label, description, color, created_at, updated_at
         FROM polyvalence_level_definitions WHERE level_value = ?`,
        [level]
    ),

    updateLevel: (level, values, conn = db) => conn.run(
        `UPDATE polyvalence_level_definitions
         SET label = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP
         WHERE level_value = ?`,
        [values.label, values.description, values.color, level]
    ),

    listPeriods: (departmentId = null, conn = db) => {
        const scopeFilter = departmentId ? 'WHERE p.department_id = ?' : '';
        return conn.all(
            `SELECT ${periodColumns}, d.name AS department_name,
                    COALESCE(t.task_total, 0) AS task_total,
                    COALESCE(t.task_completed, 0) AS task_completed
             FROM polyvalence_periods p
             JOIN polyvalence_departments d ON d.id = p.department_id
             LEFT JOIN (
                 SELECT period_id, COUNT(*) AS task_total,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS task_completed
                 FROM polyvalence_review_tasks
                 GROUP BY period_id
             ) t ON t.period_id = p.id
             ${scopeFilter}
             ORDER BY p.start_date DESC, p.id DESC`,
            departmentId ? [departmentId] : []
        );
    },

    createPeriod: async (values, conn = db) => {
        const result = await conn.run(
            `INSERT INTO polyvalence_periods
             (department_id, previous_period_id, name, start_date, end_date, due_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                values.department_id,
                values.previous_period_id || null,
                values.name,
                values.start_date,
                values.end_date,
                values.due_date,
                values.status || 'draft'
            ]
        );
        return result.lastID;
    },

    getPeriod: (periodId, conn = db) => conn.get(
        `SELECT ${periodColumns} FROM polyvalence_periods p WHERE p.id = ?`,
        [periodId]
    ),

    getPeriodWithDepartment: (periodId, conn = db) => conn.get(
        `SELECT ${periodColumns}, d.name AS department_name
         FROM polyvalence_periods p
         JOIN polyvalence_departments d ON d.id = p.department_id
         WHERE p.id = ?`,
        [periodId]
    ),

    findOtherOpenPeriod: (departmentId, periodId, conn = db) => conn.get(
        `SELECT id FROM polyvalence_periods
         WHERE department_id = ? AND status = 'open' AND id <> ?`,
        [departmentId, periodId]
    ),

    findActivePeriod: (departmentId, conn = db) => conn.get(
        `SELECT id, status, name, start_date, end_date, due_date
         FROM polyvalence_periods
         WHERE department_id = ? AND status IN ('draft', 'open')`,
        [departmentId]
    ),

    findLatestClosedPeriod: (departmentId, excludedPeriodId = null, conn = db) => {
        const exclusion = excludedPeriodId ? 'AND id <> ?' : '';
        return conn.get(
            `SELECT id FROM polyvalence_periods
             WHERE department_id = ? AND status = 'closed' ${exclusion}
             ORDER BY closed_at DESC, id DESC`,
            excludedPeriodId ? [departmentId, excludedPeriodId] : [departmentId]
        );
    },

    listActiveMembers: (departmentId, conn = db) => conn.all(
        `SELECT m.id, m.user_id, m.department_id, m.role_id, m.evaluator_user_id,
                u.employee_id, u.name AS employee_name, u.position,
                e.name AS evaluator_name, d.name AS department_name, r.name AS role_name
         FROM polyvalence_memberships m
         JOIN users u ON u.id = m.user_id
         JOIN polyvalence_departments d ON d.id = m.department_id
         LEFT JOIN users e ON e.id = m.evaluator_user_id
         LEFT JOIN polyvalence_roles r ON r.id = m.role_id
         WHERE m.department_id = ? AND COALESCE(m.is_active, 1) = 1
           AND COALESCE(u.status, 'active') = 'active'`,
        [departmentId]
    ),

    listActiveTargets: (departmentId, conn = db) => conn.all(
        `SELECT st.id, st.skill_id, st.role_id, st.target_level, st.criticality,
                st.min_qualified_count, s.name AS skill_name,
                s.description AS skill_description, c.name AS category_name
         FROM polyvalence_skill_targets st
         JOIN polyvalence_skills s ON s.id = st.skill_id
         LEFT JOIN polyvalence_skill_categories c ON c.id = s.category_id
         WHERE s.department_id = ? AND COALESCE(s.is_archived, 0) = 0
         ORDER BY c.name, s.name`,
        [departmentId]
    ),

    listAssessmentCarryOver: (periodId, conn = db) => {
        if (!periodId) return Promise.resolve([]);
        return conn.all(
            `SELECT pm.user_id, ps.skill_id, a.level_value, a.can_train
             FROM polyvalence_assessments a
             JOIN polyvalence_period_members pm ON pm.id = a.period_member_id
             JOIN polyvalence_period_skills ps ON ps.id = a.period_skill_id
             WHERE a.period_id = ?`,
            [periodId]
        );
    },

    markPeriodOpen: (periodId, previousPeriodId, actorUserId, conn = db) => conn.run(
        `UPDATE polyvalence_periods
         SET status = 'open', previous_period_id = ?, opened_at = CURRENT_TIMESTAMP,
             opened_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'draft'`,
        [previousPeriodId, actorUserId, periodId]
    ),

    insertPeriodMember: async (periodId, member, conn = db) => {
        const result = await conn.run(
            `INSERT INTO polyvalence_period_members
             (period_id, user_id, role_id, evaluator_user_id, employee_id_snapshot,
              employee_name_snapshot, department_name_snapshot, position_snapshot,
              role_name_snapshot, evaluator_name_snapshot)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                periodId,
                member.user_id,
                member.role_id || null,
                member.evaluator_user_id,
                member.employee_id || null,
                member.employee_name,
                member.department_name,
                member.position || null,
                member.role_name || null,
                member.evaluator_name
            ]
        );
        return result.lastID;
    },

    insertPeriodSkill: async (periodId, skill, conn = db) => {
        const result = await conn.run(
            `INSERT INTO polyvalence_period_skills
             (period_id, skill_id, skill_code_snapshot, skill_name_snapshot,
              category_name_snapshot, sort_order_snapshot)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [periodId, skill.id, null, skill.name, skill.category_name || 'Genel', 0]
        );
        return result.lastID;
    },

    insertAssessment: (periodId, periodMemberId, periodSkillId, target, carryOver, conn = db) => (
        conn.run(
            `INSERT INTO polyvalence_assessments
             (period_id, period_member_id, period_skill_id, target_level_snapshot,
              criticality_snapshot, min_qualified_count_snapshot, level_value, can_train)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                periodId,
                periodMemberId,
                periodSkillId,
                target.target_level,
                target.criticality || 'normal',
                Number(target.min_qualified_count || 1),
                carryOver.level,
                carryOver.canTrain ? 1 : 0
            ]
        )
    ),

    insertTask: (periodId, evaluatorId, conn = db) => conn.run(
        `INSERT INTO polyvalence_review_tasks (period_id, evaluator_user_id, status)
         VALUES (?, ?, 'pending')`,
        [periodId, evaluatorId]
    ),

    listDueOpenPeriods: (today, conn = db) => conn.all(
        `SELECT ${periodColumns}, d.name AS department_name
         FROM polyvalence_periods p
         JOIN polyvalence_departments d ON d.id = p.department_id
         WHERE p.status = 'open' AND p.due_date < ?`,
        [today]
    ),

    closePeriod: (periodId, actorUserId, conn = db) => conn.run(
        `UPDATE polyvalence_periods
         SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'open'`,
        [actorUserId, periodId]
    ),

    listActiveSchedules: (conn = db) => conn.all(
        `SELECT s.id, s.department_id, s.frequency_months, s.next_start_date,
                s.duration_days, s.reminder_days, s.is_active,
                d.name AS department_name
         FROM polyvalence_schedules s
         JOIN polyvalence_departments d ON d.id = s.department_id
         WHERE COALESCE(s.is_active, 1) = 1
         ORDER BY d.name`
    ),

    getActiveSchedule: (departmentId, conn = db) => conn.get(
        `SELECT id, department_id, frequency_months, next_start_date,
                duration_days, reminder_days, is_active
         FROM polyvalence_schedules
         WHERE department_id = ? AND COALESCE(is_active, 1) = 1`,
        [departmentId]
    ),

    getSchedule: (departmentId, conn = db) => conn.get(
        'SELECT * FROM polyvalence_schedules WHERE department_id = ?',
        [departmentId]
    ),

    saveSchedule: async (current, data, conn = db) => {
        const values = [
            data.frequencyMonths,
            data.nextStartDate,
            data.durationDays,
            data.reminderDays,
            data.isActive ? 1 : 0
        ];
        if (current) {
            await conn.run(
                `UPDATE polyvalence_schedules
                 SET frequency_months = ?, next_start_date = ?, duration_days = ?, reminder_days = ?,
                     is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [...values, current.id]
            );
        } else {
            await conn.run(
                `INSERT INTO polyvalence_schedules
                 (frequency_months, next_start_date, duration_days, reminder_days, is_active, department_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [...values, data.departmentId]
            );
        }
    },

    updateScheduleNextStart: (scheduleId, startDate, conn = db) => conn.run(
        `UPDATE polyvalence_schedules
         SET next_start_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [startDate, scheduleId]
    ),

    listOpenPeriods: (conn = db) => conn.all(
        `SELECT ${periodColumns}, d.name AS department_name
         FROM polyvalence_periods p
         JOIN polyvalence_departments d ON d.id = p.department_id
         WHERE p.status = 'open'
         ORDER BY p.start_date DESC, p.id DESC`
    ),

    listPeriodMembers: (periodId, conn = db) => conn.all(
        `SELECT id, user_id, role_id, evaluator_user_id
         FROM polyvalence_period_members WHERE period_id = ?`,
        [periodId]
    ),

    listPeriodSkills: (periodId, conn = db) => conn.all(
        `SELECT id, skill_id FROM polyvalence_period_skills WHERE period_id = ?`,
        [periodId]
    ),

    listPeriodAssessmentKeys: (periodId, conn = db) => conn.all(
        `SELECT a.id, a.period_member_id, ps.skill_id
         FROM polyvalence_assessments a
         JOIN polyvalence_period_skills ps ON ps.id = a.period_skill_id
         WHERE a.period_id = ?`,
        [periodId]
    ),

    findTask: (periodId, evaluatorId, conn = db) => conn.get(
        `SELECT id, status FROM polyvalence_review_tasks
         WHERE period_id = ? AND evaluator_user_id = ?`,
        [periodId, evaluatorId]
    ),

    reopenTaskForSync: (taskId, conn = db) => conn.run(
        `UPDATE polyvalence_review_tasks
         SET status = 'in_progress', completed_at = NULL, reopened_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [taskId]
    ),

    getTaskCounts: (periodId, conn = db) => conn.get(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
         FROM polyvalence_review_tasks WHERE period_id = ?`,
        [periodId]
    ),

    cancelPeriod: (periodId, actorUserId, reason, conn = db) => conn.run(
        `UPDATE polyvalence_periods
         SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?,
             cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [actorUserId, reason, periodId]
    ),

    cancelPeriodTasks: (periodId, conn = db) => conn.run(
        `UPDATE polyvalence_review_tasks
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE period_id = ?`,
        [periodId]
    ),

    getTaskWithPeriodStatus: (taskId, conn = db) => conn.get(
        `SELECT t.id, t.period_id, t.evaluator_user_id, t.status,
                p.status AS period_status
         FROM polyvalence_review_tasks t
         JOIN polyvalence_periods p ON p.id = t.period_id
         WHERE t.id = ?`,
        [taskId]
    ),

    reopenTask: (taskId, actorUserId, reason, conn = db) => conn.run(
        `UPDATE polyvalence_review_tasks
         SET status = 'in_progress', completed_at = NULL, reopened_at = CURRENT_TIMESTAMP,
             reopened_by = ?, reopen_reason = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [actorUserId, reason, taskId]
    )
});

module.exports = { createPeriodRepository };
