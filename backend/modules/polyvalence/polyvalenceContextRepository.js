function createPolyvalenceContextRepository(db) {
    return {
        listUserPoolSource() {
            return db.all(`
                SELECT department, position
                FROM users
                WHERE COALESCE(status, 'active') = 'active'
            `);
        },
        listDepartments(orderBy = '') {
            return db.all(
                `SELECT * FROM polyvalence_departments ${orderBy
                    ? `ORDER BY ${orderBy}`
                    : ''}`
            );
        },
        listRoles(orderBy = '') {
            return db.all(
                `SELECT * FROM polyvalence_roles ${orderBy ? `ORDER BY ${orderBy}` : ''}`
            );
        },
        restoreDepartment(id) {
            return db.run(`
                UPDATE polyvalence_departments
                SET is_archived = 0, archived_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [id]);
        },
        async createDepartment(name) {
            const result = await db.run(`
                INSERT INTO polyvalence_departments (name, source_department_name)
                VALUES (?, ?)
            `, [name, name]);
            return db.get(
                'SELECT * FROM polyvalence_departments WHERE id = ?',
                [result.lastID]
            );
        },
        restoreRole(id) {
            return db.run(`
                UPDATE polyvalence_roles
                SET is_archived = 0, archived_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [id]);
        },
        createRole(departmentId, name) {
            return db.run(
                `INSERT INTO polyvalence_roles (department_id, name)
                 VALUES (?, ?)`,
                [departmentId, name]
            );
        },
        findUser(userId) {
            return db.get(`
                SELECT id, employee_id, name, department, position,
                       manager_id, status
                FROM users
                WHERE id = ?
            `, [userId]);
        },
        findUserDepartment(userId) {
            return db.get('SELECT department FROM users WHERE id = ?', [userId]);
        },
        findPeriodForDepartment(periodId, departmentId) {
            return db.get(`
                SELECT id FROM polyvalence_periods
                WHERE id = ? AND department_id = ?
            `, [periodId, departmentId]);
        },
        insertAudit(data) {
            return db.run(`
                INSERT INTO polyvalence_audit_logs (
                    entity_type, entity_id, action, old_value, new_value,
                    reason, actor_user_id, ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.entityType,
                data.entityId,
                data.action,
                data.oldValue === null ? null : JSON.stringify(data.oldValue),
                data.newValue === null ? null : JSON.stringify(data.newValue),
                data.reason || null,
                data.actorUserId || null,
                data.ipAddress || null,
                data.userAgent || null
            ]);
        },
        async listSetupUsers(pagination, search) {
            const params = [];
            const clauses = ["COALESCE(u.status, 'active') = 'active'"];
            if (search) {
                const pattern = `%${String(search).trim().slice(0, 255)}%`;
                clauses.push('(u.name LIKE ? OR u.employee_id LIKE ? OR u.department LIKE ? OR u.position LIKE ?)');
                params.push(pattern, pattern, pattern, pattern);
            }
            const where = `WHERE ${clauses.join(' AND ')}`;
            const total = await db.get(`SELECT COUNT(*) AS total FROM users u ${where}`, params);
            const items = await db.all(`
                WITH ranked_users AS (
                    SELECT u.id, u.employee_id, u.name, u.department, u.position,
                           u.manager_id, u.status, manager.name AS manager_name,
                           ROW_NUMBER() OVER (ORDER BY u.name, u.employee_id, u.id) AS row_num
                    FROM users u
                    LEFT JOIN users manager ON manager.id = u.manager_id
                    ${where}
                )
                SELECT id, employee_id, name, department, position, manager_id, manager_name, status
                FROM ranked_users
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return { items, total: Number(total?.total || 0) };
        },
        async listSetupMemberships(pagination, search) {
            const fromSql = `
                FROM polyvalence_memberships m
                JOIN users u ON u.id = m.user_id
                JOIN polyvalence_departments d ON d.id = m.department_id
                LEFT JOIN users e ON e.id = m.evaluator_user_id
                LEFT JOIN polyvalence_roles r ON r.id = m.role_id
            `;
            const params = [];
            let where = '';
            if (search) {
                const pattern = `%${String(search).trim().slice(0, 255)}%`;
                where = `WHERE u.name LIKE ? OR u.employee_id LIKE ? OR u.department LIKE ?
                         OR u.position LIKE ? OR e.name LIKE ?`;
                params.push(pattern, pattern, pattern, pattern, pattern);
            }
            const total = await db.get(`SELECT COUNT(*) AS total ${fromSql} ${where}`, params);
            const items = await db.all(`
                WITH ranked_memberships AS (
                    SELECT m.*, u.name AS user_name, u.employee_id, u.position,
                           u.department AS source_department,
                           e.name AS evaluator_name, r.name AS role_name,
                           d.name AS department_name,
                           CASE WHEN (
                                LOWER(COALESCE(d.source_department_name, d.name))
                                    = LOWER(COALESCE(u.department, ''))
                                OR LOWER(d.name) = LOWER(COALESCE(u.department, ''))
                           ) THEN 1 ELSE 0 END AS is_department_auto,
                           CASE WHEN COALESCE(m.evaluator_user_id, 0)
                                = COALESCE(u.manager_id, 0)
                           THEN 1 ELSE 0 END AS is_evaluator_auto,
                           ROW_NUMBER() OVER (ORDER BY u.name, u.employee_id, m.id) AS row_num
                    ${fromSql}
                    ${where}
                )
                SELECT *
                FROM ranked_memberships
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return {
                items: items.map(({ row_num: _rowNumber, ...item }) => item),
                total: Number(total?.total || 0)
            };
        },
        async loadSetup(options = {}) {
            const includeLargeCollections = options.includeLargeCollections !== false;
            const [
                departments, roles, categories, skills, targets, memberships,
                schedules, levels, users, videos, trainingLinks, activeMembershipCount
            ] = await Promise.all([
                db.all(`
                    SELECT DISTINCT d.*
                    FROM polyvalence_departments d
                    JOIN users u ON COALESCE(u.status, 'active') = 'active'
                     AND (
                        LOWER(COALESCE(d.source_department_name, d.name))
                            = LOWER(COALESCE(u.department, ''))
                        OR LOWER(d.name) = LOWER(COALESCE(u.department, ''))
                     )
                    ORDER BY d.is_archived, d.name
                `),
                db.all(`
                    SELECT DISTINCT r.*
                    FROM polyvalence_roles r
                    JOIN polyvalence_departments d ON d.id = r.department_id
                    JOIN users u ON COALESCE(u.status, 'active') = 'active'
                     AND (
                        LOWER(COALESCE(d.source_department_name, d.name))
                            = LOWER(COALESCE(u.department, ''))
                        OR LOWER(d.name) = LOWER(COALESCE(u.department, ''))
                     )
                     AND LOWER(r.name) = LOWER(COALESCE(u.position, ''))
                    ORDER BY r.is_archived, r.name
                `),
                db.all(`
                    SELECT c.*
                    FROM polyvalence_skill_categories c
                    JOIN polyvalence_departments d ON d.id = c.department_id
                    WHERE EXISTS (
                        SELECT 1 FROM users u
                        WHERE COALESCE(u.status, 'active') = 'active'
                          AND (
                            LOWER(COALESCE(d.source_department_name, d.name))
                                = LOWER(COALESCE(u.department, ''))
                            OR LOWER(d.name) = LOWER(COALESCE(u.department, ''))
                          )
                    )
                    ORDER BY c.is_archived, c.name
                `),
                db.all(`
                    SELECT s.*, c.name AS category_name,
                           d.name AS department_name
                    FROM polyvalence_skills s
                    JOIN polyvalence_departments d ON d.id = s.department_id
                    LEFT JOIN polyvalence_skill_categories c ON c.id = s.category_id
                    WHERE EXISTS (
                        SELECT 1 FROM users u
                        WHERE COALESCE(u.status, 'active') = 'active'
                          AND (
                            LOWER(COALESCE(d.source_department_name, d.name))
                                = LOWER(COALESCE(u.department, ''))
                            OR LOWER(d.name) = LOWER(COALESCE(u.department, ''))
                          )
                    )
                    ORDER BY s.is_archived, c.name, s.name
                `),
                db.all('SELECT * FROM polyvalence_skill_targets'),
                includeLargeCollections ? db.all(`
                    SELECT m.*, u.name AS user_name, u.employee_id, u.position,
                           u.department AS source_department,
                           e.name AS evaluator_name, r.name AS role_name,
                           d.name AS department_name,
                           CASE WHEN (
                                LOWER(COALESCE(d.source_department_name, d.name))
                                    = LOWER(COALESCE(u.department, ''))
                                OR LOWER(d.name)
                                    = LOWER(COALESCE(u.department, ''))
                           ) THEN 1 ELSE 0 END AS is_department_auto,
                           CASE WHEN COALESCE(m.evaluator_user_id, 0)
                                = COALESCE(u.manager_id, 0)
                           THEN 1 ELSE 0 END AS is_evaluator_auto
                    FROM polyvalence_memberships m
                    JOIN users u ON u.id = m.user_id
                    JOIN polyvalence_departments d ON d.id = m.department_id
                    LEFT JOIN users e ON e.id = m.evaluator_user_id
                    LEFT JOIN polyvalence_roles r ON r.id = m.role_id
                    ORDER BY u.name
                `) : Promise.resolve([]),
                db.all('SELECT * FROM polyvalence_schedules'),
                db.all(`
                    SELECT * FROM polyvalence_level_definitions
                    ORDER BY level_value
                `),
                includeLargeCollections ? db.all(`
                    SELECT id, employee_id, name, department, position,
                           manager_id, status
                    FROM users
                    WHERE COALESCE(status, 'active') = 'active'
                    ORDER BY name
                `) : Promise.resolve([]),
                db.all('SELECT id, title, category FROM videos ORDER BY title'),
                db.all('SELECT * FROM polyvalence_skill_trainings'),
                db.get(`SELECT COUNT(*) AS total FROM polyvalence_memberships
                        WHERE COALESCE(is_active, 1) = 1`)
            ]);
            return {
                departments,
                roles,
                categories,
                skills,
                targets,
                memberships,
                schedules,
                levels,
                users,
                videos,
                training_links: trainingLinks,
                active_membership_count: Number(activeMembershipCount?.total || 0)
            };
        }
    };
}

module.exports = { createPolyvalenceContextRepository };
