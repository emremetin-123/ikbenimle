const TRAINING_VIDEO_COLUMNS = `
    id, title, url, description, category, pass_score, trainer_name, trainer_title,
    duration, validity_period, awards_badge, certificate_enabled, auto_reassign_enabled,
    validity_amount, validity_unit, pause_on_blur, disable_forward_seek,
    track_watch_seconds, quiz_attempt_limit, training_profile, delivery_method,
    is_mandatory, compliance_lock, version_no, parent_video_id, is_latest, is_active,
    minimum_watch_percent, requires_full_watch, requires_quiz,
    official_documents_enabled, detailed_audit_enabled, cover_image_url, badge_image_url
`;

const createAdminTrainingCatalogRepository = db => ({
    async listVideos(filters, pagination) {
        const clauses = ['COALESCE(is_latest, 1) = 1', 'COALESCE(is_active, 1) = 1'];
        const params = [];
        if (filters.search) {
            const pattern = `%${filters.search}%`;
            clauses.push('(title LIKE ? OR description LIKE ? OR category LIKE ? OR trainer_name LIKE ?)');
            params.push(pattern, pattern, pattern, pattern);
        }
        if (filters.category) {
            clauses.push('category = ?');
            params.push(filters.category);
        }
        if (filters.profile) {
            clauses.push('training_profile = ?');
            params.push(filters.profile);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;
        const sortColumns = { id: 'id', title: 'title', category: 'category', training_profile: 'training_profile' };
        const sortColumn = sortColumns[filters.sort] || sortColumns.id;
        const sortDirection = filters.order === 'asc' ? 'ASC' : 'DESC';
        const [total, items] = await Promise.all([
            db.get(`SELECT COUNT(*) AS total FROM videos ${where}`, params),
            db.all(`
                WITH ranked_videos AS (
                    SELECT ${TRAINING_VIDEO_COLUMNS},
                           ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, id DESC) AS row_num
                    FROM videos ${where}
                )
                SELECT ${TRAINING_VIDEO_COLUMNS}
                FROM ranked_videos
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow])
        ]);
        return { items, total: total?.total };
    },

    async listOptions(search, pagination) {
        const clauses = ['COALESCE(is_latest, 1) = 1', 'COALESCE(is_active, 1) = 1'];
        const params = [];
        if (search) {
            clauses.push('(title LIKE ? OR category LIKE ?)');
            const pattern = `%${search}%`;
            params.push(pattern, pattern);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;
        const [total, items] = await Promise.all([
            db.get(`SELECT COUNT(*) AS total FROM videos ${where}`, params),
            db.all(`
                WITH ranked_options AS (
                    SELECT id, title, category, training_profile,
                           ROW_NUMBER() OVER (ORDER BY title, id) AS row_num
                    FROM videos ${where}
                )
                SELECT id, title, category, training_profile
                FROM ranked_options
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow])
        ]);
        return { items, total: total?.total };
    },

    findVideo(videoId) {
        return db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
    },

    listVideoLessons(videoId) {
        return db.all(`
            SELECT l.*, q.data AS quiz_data, m.title AS module_title,
                   m.description AS module_description, m.order_index AS module_index
            FROM lessons l
            LEFT JOIN quizzes q ON q.lesson_id = l.id
            LEFT JOIN training_modules m ON m.id = l.module_id
            WHERE l.video_id = ?
            ORDER BY l.order_index ASC
        `, [videoId]);
    }
});

module.exports = { createAdminTrainingCatalogRepository };
