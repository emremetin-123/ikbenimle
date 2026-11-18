const SORT_COLUMNS = {
    name: 'u.name',
    department: 'u.department',
    position: 'u.position'
};

function createDirectoryRepository(db) {
    return {
        async list({ query, pagination }) {
            const clauses = ["(u.status IS NULL OR u.status = 'active')"];
            const params = [];
            if (query.department) {
                clauses.push('u.department = ?');
                params.push(query.department);
            }
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push('(u.name LIKE ? OR u.department LIKE ? OR u.position LIKE ?)');
                params.push(pattern, pattern, pattern);
            }
            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const sortColumn = SORT_COLUMNS[query.sort] || SORT_COLUMNS.name;
            const sortDirection = query.order === 'desc' ? 'DESC' : 'ASC';
            const total = await db.get(
                `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
                params
            );
            const items = await db.all(`
                WITH ranked_directory AS (
                    SELECT
                        u.id, u.name, u.department, u.position,
                        p.photo_path, p.photo_path AS photo_url,
                        ROW_NUMBER() OVER (
                            ORDER BY ${sortColumn} ${sortDirection}, u.id ASC
                        ) AS row_num
                    FROM users u
                    LEFT JOIN personal_info p ON p.user_id = u.id
                    ${whereSql}
                )
                SELECT id, name, department, position, photo_path, photo_url
                FROM ranked_directory
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return { items, total: total?.total || 0 };
        },

        async listBirthdays({ month, day, pagination }) {
            const datePredicate = process.env.DB_TYPE === 'postgres'
                ? 'EXTRACT(MONTH FROM p.birth_date) = ? AND EXTRACT(DAY FROM p.birth_date) = ?'
                : "CAST(strftime('%m', p.birth_date) AS INTEGER) = ? AND CAST(strftime('%d', p.birth_date) AS INTEGER) = ?";
            const total = await db.get(`
                SELECT COUNT(*) AS total
                FROM users u
                JOIN personal_info p ON p.user_id = u.id
                WHERE (u.status IS NULL OR u.status = 'active')
                  AND p.birth_date IS NOT NULL
                  AND ${datePredicate}
            `, [month, day]);
            const items = await db.all(`
                WITH ranked_birthdays AS (
                    SELECT
                        u.id, u.name, u.department,
                        p.photo_path, p.photo_path AS photo_url,
                        ROW_NUMBER() OVER (ORDER BY u.name ASC, u.id ASC) AS row_num
                    FROM users u
                    JOIN personal_info p ON p.user_id = u.id
                    WHERE (u.status IS NULL OR u.status = 'active')
                      AND p.birth_date IS NOT NULL
                      AND ${datePredicate}
                )
                SELECT id, name, department, photo_path, photo_url
                FROM ranked_birthdays
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [month, day, pagination.startRow, pagination.endRow]);
            return { items, total: total?.total || 0 };
        },

        findById(id, includeContact) {
            const contactColumns = includeContact
                ? ', p.phone, p.email AS personal_email'
                : '';
            return db.get(`
                SELECT
                    u.id, u.name, u.department, u.position,
                    p.education, p.hobbies, p.skills, p.photo_path
                    ${contactColumns}
                FROM users u
                LEFT JOIN personal_info p ON p.user_id = u.id
                WHERE u.id = ? AND (u.status IS NULL OR u.status = 'active')
            `, [id]);
        },

        listBadges(userId) {
            return db.all(`
                SELECT v.id, v.title, v.category, v.badge_image_url, a.completed_at
                FROM assignments a
                JOIN videos v ON v.id = a.video_id
                WHERE a.user_id = ?
                  AND a.status = 'completed'
                  AND COALESCE(v.awards_badge, 1) = 1
                ORDER BY a.completed_at DESC, v.id DESC
            `, [userId]);
        },

        listEducation(userId) {
            return db.all(
                `SELECT id, school, department, start_year, end_year, is_current
                 FROM profile_education_entries
                 WHERE user_id = ?
                 ORDER BY order_index, id`,
                [userId]
            );
        },

        listInterests(userId) {
            return db.all(
                `SELECT kind, label
                 FROM profile_interests
                 WHERE user_id = ?
                 ORDER BY kind, order_index, id`,
                [userId]
            );
        }
    };
}

module.exports = { createDirectoryRepository };
