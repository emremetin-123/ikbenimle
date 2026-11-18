const {
    getRatingSummary,
    getRatingOverall,
    getRatingRows
} = require('./mealRatingRepository');

function createMealMenuRepository(db) {
    return {
        findMenu(date) {
            return db.get(`
                SELECT id, meal_date, items, source_file, created_at, updated_at
                FROM meal_menus WHERE meal_date = ?
            `, [date]);
        },
        findRating(date, userId) {
            return db.get(`
                SELECT id, meal_date, food_score, staff_score, cleanliness_score,
                       comment, department, position, created_at, updated_at
                FROM meal_menu_ratings
                WHERE meal_date = ? AND user_id = ?
            `, [date, userId]);
        },
        findUserProfile(userId) {
            return db.get('SELECT department, position FROM users WHERE id = ?', [userId]);
        },
        async saveRating(date, userId, body, profile) {
            const params = [
                body.food_score, body.staff_score, body.cleanliness_score,
                body.comment || null, profile?.department || null,
                profile?.position || null, date, userId
            ];
            const result = await db.run(`
                UPDATE meal_menu_ratings
                SET food_score = ?, staff_score = ?, cleanliness_score = ?,
                    comment = ?, department = ?, position = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE meal_date = ? AND user_id = ?
            `, params);
            if (!result.changes) {
                await db.run(`
                    INSERT INTO meal_menu_ratings (
                        food_score, staff_score, cleanliness_score, comment,
                        department, position, meal_date, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, params);
            }
            return this.findRating(date, userId);
        },
        async listMenus(start, end, pagination) {
            const params = [start, end];
            const [count, items] = await Promise.all([
                db.get(
                    'SELECT COUNT(*) AS total FROM meal_menus WHERE meal_date >= ? AND meal_date < ?',
                    params
                ),
                db.all(`
                    WITH ranked_menus AS (
                        SELECT id, meal_date, items, source_file, created_at, updated_at,
                               ROW_NUMBER() OVER (ORDER BY meal_date ASC, id ASC) AS row_num
                        FROM meal_menus WHERE meal_date >= ? AND meal_date < ?
                    )
                    SELECT id, meal_date, items, source_file, created_at, updated_at
                    FROM ranked_menus WHERE row_num BETWEEN ? AND ? ORDER BY row_num
                `, [...params, pagination.startRow, pagination.endRow])
            ]);
            return { items, total: count?.total || 0 };
        },
        ratingSummary(start, end) {
            return Promise.all([
                getRatingSummary(db, start, end),
                getRatingOverall(db, start, end)
            ]);
        },
        async listRatings(start, end, date, pagination = null) {
            const clauses = ['meal_date >= ?', 'meal_date < ?'];
            const params = [start, end];
            if (date) {
                clauses.push('meal_date = ?');
                params.push(date);
            }
            const count = pagination
                ? await db.get(
                    `SELECT COUNT(*) AS total FROM meal_menu_ratings WHERE ${clauses.join(' AND ')}`,
                    params
                )
                : null;
            const items = await getRatingRows(db, start, end, { date, pagination });
            return { items, total: count?.total || items.length };
        },
        saveMenus(menus, sourceFile, userId, splitItems) {
            return db.transaction(async (tx) => {
                for (const menu of menus) {
                    const payload = JSON.stringify(splitItems(menu.items));
                    const result = await tx.run(`
                        UPDATE meal_menus SET items = ?, source_file = ?, created_by = ?,
                            updated_at = CURRENT_TIMESTAMP WHERE meal_date = ?
                    `, [payload, sourceFile, userId, menu.meal_date]);
                    if (!result.changes) {
                        await tx.run(`
                            INSERT INTO meal_menus (meal_date, items, source_file, created_by)
                            VALUES (?, ?, ?, ?)
                        `, [menu.meal_date, payload, sourceFile, userId]);
                    }
                }
                return menus.length;
            });
        },
        remove(date) {
            return db.run('DELETE FROM meal_menus WHERE meal_date = ?', [date]);
        }
    };
}
module.exports = { createMealMenuRepository };
