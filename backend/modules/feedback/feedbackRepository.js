const { DECISIONS, LEGACY_REVIEW_STAGES } = require('./feedbackPolicy');

// Keep the workflow state for existing API clients and project the visible
// outcome separately. List, detail, filters and exports use the same projection.
const FEEDBACK_STATUS_SQL = `CASE
    WHEN f.status IN ('resolved', 'completed') AND f.decision = 'rejected' THEN 'rejected'
    ELSE f.status END`;
const FEEDBACK_DISPLAY_STATUS_SQL = `CASE
    WHEN f.status IN ('resolved', 'completed') THEN
        CASE WHEN f.decision IN (${DECISIONS.map(value => `'${value}'`).join(', ')}) THEN f.decision ELSE 'completed' END
    WHEN f.status IN (${LEGACY_REVIEW_STAGES.map(value => `'${value}'`).join(', ')}) THEN 'in_review'
    ELSE f.status END`;
const FEEDBACK_COLUMNS = `
    f.id, f.user_id, f.type, f.title, f.content, ${FEEDBACK_STATUS_SQL} AS status, f.created_at,
    ${FEEDBACK_DISPLAY_STATUS_SQL} AS display_status,
    f.details, f.file_path, f.assigned_to_user_id, f.assigned_department,
    f.due_date, f.decision, f.decision_note, f.public_response, f.updated_at,
    u.name AS user_name, u.employee_id, u.department, u.position,
    au.name AS assigned_to_name, au.department AS assigned_to_department
`;

const buildWhere = (filters) => {
    const clauses = [];
    const params = [];
    if (filters.search) {
        const pattern = `%${filters.search}%`;
        clauses.push('(f.title LIKE ? OR f.content LIKE ? OR u.name LIKE ? OR u.employee_id LIKE ?)');
        params.push(pattern, pattern, pattern, pattern);
    }
    if (filters.status) {
        const statusColumn = ['resolved', 'waiting_opinion', 'in_progress'].includes(filters.status)
            ? FEEDBACK_STATUS_SQL : FEEDBACK_DISPLAY_STATUS_SQL;
        clauses.push(`${statusColumn} = ?`);
        params.push(filters.status);
    }
    if (filters.type) {
        const aliases = filters.type === 'complaint' ? ['complaint', 'Şikayet', 'Şikâyet']
            : filters.type === 'suggestion' ? ['suggestion', 'Öneri'] : [filters.type];
        clauses.push(`f.type IN (${aliases.map(() => '?').join(',')})`);
        params.push(...aliases);
    }
    if (filters.startDate) {
        clauses.push('f.created_at >= ?');
        params.push(filters.startDate);
    }
    if (filters.endDate) {
        clauses.push('f.created_at < ?');
        params.push(filters.endDate);
    }
    return {
        sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
        params
    };
};

const SORT_COLUMNS = {
    created_at: 'f.created_at',
    status: FEEDBACK_DISPLAY_STATUS_SQL,
    type: 'f.type',
    due_date: 'f.due_date'
};

const LIST_SELECT = `
    SELECT ${FEEDBACK_COLUMNS}
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    LEFT JOIN users au ON f.assigned_to_user_id = au.id
`;

const createFeedbackRepository = (db) => ({
    async listAdmin(filters, pagination) {
        const where = buildWhere(filters);
        const sortColumn = SORT_COLUMNS[filters.sort] || SORT_COLUMNS.created_at;
        const sortDirection = filters.order === 'asc' ? 'ASC' : 'DESC';
        const joins = `
            FROM feedback f
            LEFT JOIN users u ON f.user_id = u.id
            LEFT JOIN users au ON f.assigned_to_user_id = au.id
            ${where.sql}
        `;

        const total = await db.get(`SELECT COUNT(*) AS total ${joins}`, where.params);
        const items = await db.all(
            `WITH ranked_feedback AS (
                SELECT ${FEEDBACK_COLUMNS},
                       ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, f.id DESC) AS row_num
                ${joins}
             )
             SELECT id, user_id, type, title, content, status, display_status, created_at, details,
                    file_path, assigned_to_user_id, assigned_department, due_date,
                    decision, decision_note, public_response, updated_at, user_name,
                    employee_id, department, position, assigned_to_name,
                    assigned_to_department
             FROM ranked_feedback
             WHERE row_num BETWEEN ? AND ?
             ORDER BY row_num`,
            [...where.params, pagination.startRow, pagination.endRow]
        );
        return { items, total: Number(total?.total || 0) };
    },
    async listUserOptions(pagination, search, feedback = null) {
        const params = [];
        const clauses = ["COALESCE(status, 'active') = 'active'"];
        if (feedback) {
            clauses.push(`id <> ? AND id <> ? AND NOT EXISTS (
                SELECT 1 FROM feedback_participants p WHERE p.feedback_id = ? AND p.user_id = users.id
            )`);
            params.push(feedback.user_id ?? 0, feedback.assigned_to_user_id, feedback.id);
        }
        if (search) {
            const pattern = `%${search}%`;
            clauses.push('(name LIKE ? OR employee_id LIKE ? OR department LIKE ? OR position LIKE ?)');
            params.push(pattern, pattern, pattern, pattern);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;
        const total = await db.get(`SELECT COUNT(*) AS total FROM users ${where}`, params);
        const items = await db.all(`
            WITH ranked_options AS (
                SELECT id, employee_id, name, department, position, manager_id, status,
                       ROW_NUMBER() OVER (ORDER BY name, employee_id, id) AS row_num
                FROM users
                ${where}
            )
            SELECT id, employee_id, name, department, position, manager_id, status
            FROM ranked_options
            WHERE row_num BETWEEN ? AND ?
            ORDER BY row_num
        `, [...params, pagination.startRow, pagination.endRow]);
        return { items, total: Number(total?.total || 0) };
    },
    listMine(userId) {
        return db.all(
            `${LIST_SELECT} WHERE f.user_id = ? ORDER BY f.created_at DESC`,
            [userId]
        );
    },
    listParticipating(userId) {
        return db.all(`
            ${LIST_SELECT}
            WHERE f.assigned_to_user_id = ?
               OR EXISTS (
                   SELECT 1 FROM feedback_participants p
                   WHERE p.feedback_id = f.id AND p.user_id = ?
               )
            ORDER BY f.created_at DESC
        `, [userId, userId]);
    },
    find(id) {
        return db.get('SELECT * FROM feedback WHERE id = ?', [id]);
    },
    findForUpdate(id) {
        const lock = process.env.DB_TYPE === 'sqlite' ? '' : ' FOR UPDATE';
        return db.get(`SELECT f.*, ${FEEDBACK_DISPLAY_STATUS_SQL} AS display_status FROM feedback f WHERE f.id = ?${lock}`, [id]);
    },
    findDetail(id) {
        return db.get(`${LIST_SELECT} WHERE f.id = ?`, [id]);
    },
    async isParticipant(feedbackId, userId) {
        const row = await db.get(
            `SELECT id FROM feedback_participants
             WHERE feedback_id = ? AND user_id = ?`,
            [feedbackId, userId]
        );
        return Boolean(row);
    },
    async getThread(feedbackId, userId = null, team = false) {
        const publicClause = userId === null || team ? '' : 'AND c.is_public = 1';
        const commentParams = [feedbackId];
        const [participants, comments, history] = await Promise.all([
            db.all(`
                SELECT p.*, u.name, u.department, u.position
                FROM feedback_participants p
                JOIN users u ON p.user_id = u.id
                WHERE p.feedback_id = ?
                ORDER BY p.created_at ASC
            `, [feedbackId]),
            db.all(`
                SELECT c.id, c.feedback_id, c.user_id, c.comment, c.is_public, c.created_at,
                       c.attachment_name, u.name AS user_name, u.department, u.position
                FROM feedback_comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.feedback_id = ? ${publicClause}
                ORDER BY c.created_at ASC, c.id ASC
            `, commentParams),
            db.all(`
                SELECT h.id, h.feedback_id, h.user_id, h.old_status, h.new_status,
                       h.created_at, ${userId === null ? 'h.note' : 'NULL AS note'}, u.name AS user_name
                FROM feedback_status_history h
                LEFT JOIN users u ON h.user_id = u.id
                WHERE h.feedback_id = ?
                ORDER BY h.created_at ASC, h.id ASC
            `, [feedbackId])
        ]);
        return { participants, comments, history };
    },
    findCommentAttachment(feedbackId, commentId, includeInternal) {
        return db.get(`SELECT attachment_key, attachment_name FROM feedback_comments
            WHERE feedback_id = ? AND id = ? AND attachment_key IS NOT NULL${includeInternal ? '' : ' AND is_public = 1'}`,
        [feedbackId, commentId]);
    },
    addComment(feedbackId, userId, comment, isPublic, attachment = null) {
        return db.run(
            `INSERT INTO feedback_comments
                (feedback_id, user_id, comment, is_public, attachment_key, attachment_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [feedbackId, userId, comment, isPublic ? 1 : 0, attachment?.key ?? null, attachment?.name ?? null]
        );
    },
    async create(data) {
        const result = await db.run(`
            INSERT INTO feedback
                (user_id, type, title, content, details, file_path, storage_provider, storage_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.userId, data.type, data.title, data.content,
            data.details || null, data.filePath || null,
            data.storageProvider || null, data.storageKey || null
        ]);
        return result.lastID;
    },
    addHistory(feedbackId, userId, oldStatus, newStatus, note = null) {
        return db.run(`
            INSERT INTO feedback_status_history
                (feedback_id, user_id, old_status, new_status, note)
            VALUES (?, ?, ?, ?, ?)
        `, [feedbackId, userId || null, oldStatus || null, newStatus, note]);
    },
    updateAssignment(id, data) {
        return db.run(`
            UPDATE feedback
            SET assigned_to_user_id = ?, assigned_department = ?, due_date = ?,
                status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            data.assigned_to_user_id || null,
            data.assigned_department || null,
            data.due_date || null,
            data.status,
            id
        ]);
    },
    async addParticipants(feedbackId, userIds, addedBy) {
        const ids = [...new Set(userIds.filter(Boolean))];
        if (!ids.length) return 0;
        const result = await db.run(`INSERT INTO feedback_participants (feedback_id, user_id, added_by)
            VALUES ${ids.map(() => '(?, ?, ?)').join(', ')}
            ON CONFLICT (feedback_id, user_id) DO NOTHING`, ids.flatMap(userId => [feedbackId, userId, addedBy]));
        return result.changes;
    },
    async validateUsers(userIds) {
        const ids = [...new Set(userIds.filter(Boolean))];
        if (!ids.length) return true;
        const rows = await db.all(`SELECT id FROM users WHERE id IN (${ids.map(() => '?').join(',')})
            AND COALESCE(status, 'active') = 'active'`, ids);
        return rows.length === ids.length;
    },
    async replaceParticipants(feedbackId, userIds, addedBy) {
        const ids = [...new Set(userIds.filter(Boolean))];
        if (ids.length) {
            await db.run(`DELETE FROM feedback_participants WHERE feedback_id = ?
                AND user_id NOT IN (${ids.map(() => '?').join(',')})`, [feedbackId, ...ids]);
        } else {
            await db.run('DELETE FROM feedback_participants WHERE feedback_id = ?', [feedbackId]);
        }
        await this.addParticipants(feedbackId, ids, addedBy);
    },
    completeReview(feedbackId, userId) {
        return db.run(`UPDATE feedback_participants SET review_completed_at = CURRENT_TIMESTAMP
            WHERE feedback_id = ? AND user_id = ? AND review_completed_at IS NULL`, [feedbackId, userId]);
    },
    resetReview(feedbackId, userId = null) {
        return db.run(`UPDATE feedback_participants SET review_completed_at = NULL
            WHERE feedback_id = ?${userId === null ? '' : ' AND user_id = ?'}`,
        userId === null ? [feedbackId] : [feedbackId, userId]);
    },
    updateDecision(id, data) {
        return db.run(`
            UPDATE feedback
            SET status = ?, decision = ?, decision_note = ?, public_response = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            data.status,
            data.decision || null,
            data.decision_note || null,
            data.public_response || null,
            id
        ]);
    },
    updateStatus(id, status) {
        return db.run('UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    }
});

module.exports = {
    createFeedbackRepository
};
