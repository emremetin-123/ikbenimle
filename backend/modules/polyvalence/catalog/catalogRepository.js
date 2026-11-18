const { catalogColumns } = require('./catalogRouteSupport');

const TABLES = {
    department: 'polyvalence_departments',
    role: 'polyvalence_roles',
    category: 'polyvalence_skill_categories',
    skill: 'polyvalence_skills'
};

const createCatalogRepository = (db) => ({
    findById: (type, id) => db.get(
        `SELECT ${catalogColumns[type]} FROM ${TABLES[type]} WHERE id = ?`,
        [id]
    ),
    createDepartment: async ({ name, sourceName }) => (
        await db.run(
            'INSERT INTO polyvalence_departments (name, source_department_name) VALUES (?, ?)',
            [name, sourceName]
        )
    ).lastID,
    updateDepartment: (id, { name, sourceName }) => db.run(
        `UPDATE polyvalence_departments
         SET name = ?, source_department_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, sourceName, id]
    ),
    createRole: async ({ departmentId, name }) => (
        await db.run(
            'INSERT INTO polyvalence_roles (department_id, name) VALUES (?, ?)',
            [departmentId, name]
        )
    ).lastID,
    updateRole: (id, name) => db.run(
        'UPDATE polyvalence_roles SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, id]
    ),
    createCategory: async ({ departmentId, name }) => (
        await db.run(
            `INSERT INTO polyvalence_skill_categories (department_id, name, sort_order)
             VALUES (?, ?, 0)`,
            [departmentId, name]
        )
    ).lastID,
    updateCategory: (id, name) => db.run(
        `UPDATE polyvalence_skill_categories
         SET name = ?, sort_order = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, id]
    ),
    createSkill: async ({ departmentId, categoryId, name, description }) => (
        await db.run(
            `INSERT INTO polyvalence_skills
             (department_id, category_id, code, name, description, sort_order)
             VALUES (?, ?, NULL, ?, ?, 0)`,
            [departmentId, categoryId, name, description]
        )
    ).lastID,
    updateSkill: (id, { categoryId, name, description }) => db.run(
        `UPDATE polyvalence_skills
         SET category_id = ?, code = NULL, name = ?, description = ?, sort_order = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [categoryId, name, description, id]
    ),
    setArchived: (type, id, { archived, actorUserId, reason }) => {
        const reasonClause = type === 'skill' ? ', archive_reason = ?' : '';
        const params = [archived ? 1 : 0, archived ? 1 : 0, archived ? actorUserId : null];
        if (type === 'skill') params.push(archived ? (reason || null) : null);
        params.push(id);
        return db.run(
            `UPDATE ${TABLES[type]}
             SET is_archived = ?,
                 archived_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
                 archived_by = ?${reasonClause}, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            params
        );
    },
    replaceSkillTrainings: (skillId, videoIds) => db.transaction(async (tx) => {
        await tx.run('DELETE FROM polyvalence_skill_trainings WHERE skill_id = ?', [skillId]);
        for (const videoId of videoIds) {
            await tx.run(
                'INSERT INTO polyvalence_skill_trainings (skill_id, video_id) VALUES (?, ?)',
                [skillId, videoId]
            );
        }
    })
});

module.exports = { createCatalogRepository };
