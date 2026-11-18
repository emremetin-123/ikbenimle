const targetColumns = `
    id, skill_id, role_id, target_level, criticality, min_qualified_count,
    created_at, updated_at
`;
const membershipColumns = `
    id, user_id, department_id, role_id, evaluator_user_id, is_active,
    is_manual_override, created_at, updated_at
`;

const createMembershipRepository = (db) => ({
    loadSyncContext: async () => {
        const [users, departments, roles, memberships] = await Promise.all([
            db.all(
                `SELECT id, employee_id, name, department, position, manager_id
                 FROM users WHERE COALESCE(status, ?) = ? ORDER BY name`,
                ['active', 'active']
            ),
            db.all(
                `SELECT id, name, source_department_name, is_archived
                 FROM polyvalence_departments ORDER BY is_archived, name`
            ),
            db.all(
                `SELECT id, department_id, name, is_archived
                 FROM polyvalence_roles ORDER BY is_archived, name`
            ),
            db.all(`SELECT ${membershipColumns} FROM polyvalence_memberships`)
        ]);
        return { users, departments, roles, memberships };
    },
    findTarget: (skillId, roleId) => db.get(
        `SELECT ${targetColumns} FROM polyvalence_skill_targets
         WHERE skill_id = ? AND role_id = ?`,
        [skillId, roleId]
    ),
    saveTarget: async (current, data) => {
        if (current) {
            await db.run(
                `UPDATE polyvalence_skill_targets
                 SET target_level = ?, criticality = ?, min_qualified_count = ?,
                     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [data.target_level, data.criticality, data.min_qualified_count, current.id]
            );
        } else {
            await db.run(
                `INSERT INTO polyvalence_skill_targets
                 (skill_id, role_id, target_level, criticality, min_qualified_count)
                 VALUES (?, ?, ?, ?, ?)`,
                [data.skill_id, data.role_id, data.target_level, data.criticality, data.min_qualified_count]
            );
        }
    },
    findMembershipByUser: (userId) => db.get(
        `SELECT ${membershipColumns} FROM polyvalence_memberships WHERE user_id = ?`,
        [userId]
    ),
    findMembershipById: (id) => db.get(
        `SELECT ${membershipColumns} FROM polyvalence_memberships WHERE id = ?`,
        [id]
    ),
    saveMembership: async (current, data) => {
        const values = [
            data.departmentId,
            data.roleId,
            data.evaluatorId,
            data.isActive ? 1 : 0,
            data.isManualOverride ? 1 : 0
        ];
        if (current) {
            await db.run(
                `UPDATE polyvalence_memberships
                 SET department_id = ?, role_id = ?, evaluator_user_id = ?, is_active = ?,
                     is_manual_override = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [...values, current.id]
            );
        } else {
            await db.run(
                `INSERT INTO polyvalence_memberships
                 (department_id, role_id, evaluator_user_id, is_active, is_manual_override, user_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [...values, data.userId]
            );
        }
    },
    updateAutomaticMembership: (id, data) => db.run(
        `UPDATE polyvalence_memberships
         SET department_id = ?, role_id = ?, evaluator_user_id = ?, is_active = 1,
             is_manual_override = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [data.departmentId, data.roleId, data.evaluatorId, id]
    ),
    insertAutomaticMembership: (data) => db.run(
        `INSERT INTO polyvalence_memberships
         (user_id, department_id, role_id, evaluator_user_id, is_active, is_manual_override)
         VALUES (?, ?, ?, ?, 1, 0)`,
        [data.userId, data.departmentId, data.roleId, data.evaluatorId]
    ),
    resetMembership: (id, data) => db.run(
        `UPDATE polyvalence_memberships
         SET department_id = ?, role_id = ?, evaluator_user_id = ?, is_active = 1,
             is_manual_override = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [data.departmentId, data.roleId, data.evaluatorId, id]
    )
});

module.exports = { createMembershipRepository };
