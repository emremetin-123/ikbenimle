function createReminderRepository(db) {
    const selectColumns = `
        id, reminder_text, is_completed, is_pinned,
        created_at, updated_at, completed_at
    `;

    return {
        list(userId) {
            return db.all(`
                SELECT ${selectColumns}
                FROM personal_reminders
                WHERE user_id = ?
                ORDER BY is_completed ASC, is_pinned DESC, updated_at DESC, id DESC
            `, [userId]);
        },
        findOwned(id, userId) {
            return db.get(`
                SELECT ${selectColumns}
                FROM personal_reminders
                WHERE id = ? AND user_id = ?
            `, [id, userId]);
        },
        async create(userId, text) {
            const result = await db.run(`
                INSERT INTO personal_reminders (user_id, reminder_text)
                VALUES (?, ?)
            `, [userId, text]);
            return this.findOwned(result.lastID, userId);
        },
        async update(id, userId, body) {
            const assignments = [];
            const params = [];
            if (body.text !== undefined) {
                assignments.push('reminder_text = ?');
                params.push(body.text);
            }
            if (body.pinned !== undefined) {
                assignments.push('is_pinned = ?');
                params.push(body.pinned ? 1 : 0);
            }
            if (body.completed !== undefined) {
                assignments.push('is_completed = ?');
                params.push(body.completed ? 1 : 0);
                assignments.push(body.completed
                    ? 'completed_at = CURRENT_TIMESTAMP'
                    : 'completed_at = NULL');
            }
            assignments.push('updated_at = CURRENT_TIMESTAMP');
            await db.run(`
                UPDATE personal_reminders
                SET ${assignments.join(', ')}
                WHERE id = ? AND user_id = ?
            `, [...params, id, userId]);
            return this.findOwned(id, userId);
        },
        remove(id, userId) {
            return db.run(
                'DELETE FROM personal_reminders WHERE id = ? AND user_id = ?',
                [id, userId]
            );
        }
    };
}

module.exports = { createReminderRepository };
