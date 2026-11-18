const TRAINING_SORT_COLUMNS = {
    assigned_at: 'a.assigned_at',
    completed_at: 'a.completed_at',
    due_date: 'a.due_date',
    title: 'v.title'
};

const createEmployeeLearningRepository = db => ({
    getSummary(userId) {
        return db.get(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN COALESCE(a.status, 'assigned') <> 'completed' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE
                    WHEN COALESCE(a.status, 'assigned') <> 'completed'
                     AND a.due_date IS NOT NULL
                     AND a.due_date < CURRENT_TIMESTAMP
                    THEN 1 ELSE 0
                END) AS expired,
                SUM(CASE
                    WHEN a.status = 'completed'
                     AND COALESCE(v.awards_badge, 1) = 1
                    THEN 1 ELSE 0
                END) AS badges
            FROM assignments a
            JOIN videos v ON v.id = a.video_id
            WHERE a.user_id = ?
              AND COALESCE(a.status, '') <> 'cancelled'
        `, [userId]);
    },

    async listTrainings(userId, query, pagination) {
        const clauses = ['a.user_id = ?', "COALESCE(a.status, '') <> 'cancelled'"];
        const params = [userId];
        if (query.status === 'pending') {
            clauses.push("COALESCE(a.status, 'assigned') <> 'completed'");
        } else if (query.status === 'completed') {
            clauses.push("a.status = 'completed'");
        }
        if (query.badge === 'awarded') {
            clauses.push("a.status = 'completed'");
            clauses.push('COALESCE(v.awards_badge, 1) = 1');
        }
        if (query.search) {
            const pattern = `%${query.search}%`;
            clauses.push('(v.title LIKE ? OR v.category LIKE ? OR v.trainer_name LIKE ?)');
            params.push(pattern, pattern, pattern);
        }
        const whereSql = `WHERE ${clauses.join(' AND ')}`;
        const sortColumn = TRAINING_SORT_COLUMNS[query.sort]
            || TRAINING_SORT_COLUMNS.assigned_at;
        const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
        const total = await db.get(`
            SELECT COUNT(*) AS total
            FROM assignments a
            JOIN videos v ON v.id = a.video_id
            ${whereSql}
        `, params);
        const items = await db.all(`
            WITH ranked_trainings AS (
                SELECT
                    v.id, v.title, v.description, v.category, v.pass_score,
                    v.trainer_name, v.trainer_title, v.duration, v.awards_badge,
                    v.certificate_enabled, v.cover_image_url, v.badge_image_url,
                    a.id AS assignment_id, a.status, a.quiz_score, a.due_date,
                    a.reference_id, a.confirmed_at, a.completed_at, a.assigned_at,
                    ROW_NUMBER() OVER (
                        ORDER BY ${sortColumn} ${sortDirection}, a.id DESC
                    ) AS row_num
                FROM assignments a
                JOIN videos v ON v.id = a.video_id
                ${whereSql}
            )
            SELECT
                id, title, description, category, pass_score, trainer_name,
                trainer_title, duration, awards_badge, certificate_enabled, badge_image_url,
                cover_image_url, assignment_id, status, quiz_score, due_date,
                reference_id, confirmed_at, completed_at, assigned_at
            FROM ranked_trainings
            WHERE row_num BETWEEN ? AND ?
            ORDER BY row_num
        `, [...params, pagination.startRow, pagination.endRow]);
        return { items, total: total?.total };
    },

    findVideo(id) {
        return db.get('SELECT * FROM videos WHERE id = ?', [id]);
    },

    findAssignmentForVideo(userId, videoId) {
        return db.get(
            "SELECT * FROM assignments WHERE user_id = ? AND video_id = ? AND COALESCE(status, '') <> 'cancelled' ORDER BY id DESC",
            [userId, videoId]
        );
    },

    markFirstAccess(assignmentId) {
        return db.run(
            'UPDATE assignments SET first_accessed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [assignmentId]
        );
    },

    listLessons(videoId, assignmentId) {
        return db.all(`
            SELECT l.*, m.title AS module_title, m.description AS module_description,
                   m.order_index AS module_index,
                   q.data AS quiz_data, lp.status AS progress_status, lp.score AS progress_score,
                   lp.watched_seconds, lp.active_seconds, lp.content_progress_percent,
                   lp.page_number, lp.page_count, lp.max_position, lp.last_position,
                   lp.quiz_attempts, lp.requires_rewatch
            FROM lessons l
            LEFT JOIN training_modules m ON m.id = l.module_id
            LEFT JOIN quizzes q ON l.id = q.lesson_id
            LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.assignment_id = ?
            WHERE l.video_id = ?
            ORDER BY l.order_index ASC
        `, [assignmentId, videoId]);
    },

    findQuizLesson(lessonId) {
        return db.get(`
            SELECT l.video_id, l.module_id, q.data AS quiz_data, v.pass_score,
                   v.quiz_attempt_limit, v.requires_full_watch
            FROM lessons l
            JOIN videos v ON l.video_id = v.id
            LEFT JOIN quizzes q ON l.id = q.lesson_id
            WHERE l.id = ?
        `, [lessonId]);
    },

    findUnfinishedModuleLesson(assignmentId, moduleId, lessonId) {
        return db.get(`
            SELECT l.id FROM lessons l
            LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.assignment_id = ?
            WHERE l.module_id = ? AND l.id <> ? AND COALESCE(lp.status, '') <> 'completed'
            LIMIT 1
        `, [assignmentId, moduleId, lessonId]);
    },

    findLessonProgress(assignmentId, lessonId) {
        return db.get(
            'SELECT id, status, quiz_attempts, requires_rewatch FROM lesson_progress WHERE assignment_id = ? AND lesson_id = ?',
            [assignmentId, lessonId]
        );
    },

    updateQuizProgress(id, values) {
        return db.run(`
            UPDATE lesson_progress
            SET status = ?, score = ?, quiz_attempts = ?, requires_rewatch = ?,
                completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE id = ?
        `, [values.status, values.score, values.attempts, values.requiresRewatch, values.status, id]);
    },

    createQuizProgress(assignmentId, lessonId, values) {
        return db.run(`
            INSERT INTO lesson_progress
                (assignment_id, lesson_id, status, score, quiz_attempts,
                 requires_rewatch, completed_at)
            VALUES (?, ?, ?, ?, ?, ?,
                CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)
        `, [
            assignmentId,
            lessonId,
            values.status,
            values.score,
            values.attempts,
            values.requiresRewatch,
            values.status
        ]);
    },

    createTrainingAttempt(assignmentId, lessonId, userId, values) {
        return db.run(`
            INSERT INTO training_attempts
                (assignment_id, lesson_id, user_id, score, passed, answers_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [assignmentId, lessonId, userId, values.score, values.passed, values.answersJson]);
    },

    findAssignmentByIdForUser(id, userId) {
        return db.get(
            'SELECT * FROM assignments WHERE id = ? AND user_id = ?',
            [id, userId]
        );
    },

    findVideoCertificateSetting(videoId) {
        return db.get('SELECT certificate_enabled FROM videos WHERE id = ?', [videoId]);
    },

    confirmAssignment(id, referenceId) {
        return db.run(
            'UPDATE assignments SET confirmed_at = CURRENT_TIMESTAMP, reference_id = ? WHERE id = ?',
            [referenceId, id]
        );
    },

    findLessonContext(lessonId) {
        return db.get(`
            SELECT l.id, l.video_id, l.content_type, l.required_seconds,
                   l.required_percent, l.order_index, q.data AS quiz_data,
                   v.requires_quiz, v.requires_full_watch, v.minimum_watch_percent,
                   v.disable_forward_seek, v.detailed_audit_enabled
            FROM lessons l
            JOIN videos v ON l.video_id = v.id
            LEFT JOIN quizzes q ON l.id = q.lesson_id
            WHERE l.id = ?
        `, [lessonId]);
    },

    findPreviousLesson(videoId, orderIndex) {
        return db.get(
            'SELECT id FROM lessons WHERE video_id = ? AND order_index < ? ORDER BY order_index DESC LIMIT 1',
            [videoId, orderIndex]
        );
    },

    findProgressStatus(assignmentId, lessonId) {
        return db.get(
            'SELECT status FROM lesson_progress WHERE assignment_id = ? AND lesson_id = ?',
            [assignmentId, lessonId]
        );
    },

    upsertDocumentProgress(assignmentId, lessonId, values) {
        return db.run(`
            INSERT INTO lesson_progress
                (assignment_id, lesson_id, status, active_seconds,
                 content_progress_percent, page_number, page_count, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?,
                CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)
            ON CONFLICT(assignment_id, lesson_id) DO UPDATE SET
                status = CASE WHEN lesson_progress.status = 'completed' THEN 'completed' ELSE excluded.status END,
                active_seconds = CASE WHEN excluded.active_seconds > lesson_progress.active_seconds THEN excluded.active_seconds ELSE lesson_progress.active_seconds END,
                content_progress_percent = CASE WHEN excluded.content_progress_percent > lesson_progress.content_progress_percent THEN excluded.content_progress_percent ELSE lesson_progress.content_progress_percent END,
                page_number = CASE WHEN excluded.page_number > lesson_progress.page_number THEN excluded.page_number ELSE lesson_progress.page_number END,
                page_count = CASE WHEN excluded.page_count > lesson_progress.page_count THEN excluded.page_count ELSE lesson_progress.page_count END,
                completed_at = CASE WHEN excluded.status = 'completed' AND lesson_progress.completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE lesson_progress.completed_at END
        `, [
            assignmentId,
            lessonId,
            values.status,
            values.activeSeconds,
            values.progress,
            values.pageNumber,
            values.pageCount,
            values.status
        ]);
    },

    findCertificate(reference) {
        return db.get(`
            SELECT a.reference_id, a.confirmed_at, a.completed_at,
                   u.name, v.title, v.version_no
            FROM assignments a
            JOIN users u ON a.user_id = u.id
            JOIN videos v ON a.video_id = v.id
            WHERE a.reference_id = ?
        `, [reference]);
    },

    logEvent(values) {
        return db.run(`
            INSERT INTO training_activity_logs
                (assignment_id, user_id, video_id, lesson_id, event_type,
                 event_data, session_id, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, values);
    },

    listLessonIds(videoId) {
        return db.all('SELECT id FROM lessons WHERE video_id = ?', [videoId]);
    },

    listCompletedLessons(assignmentId) {
        return db.all(
            'SELECT lesson_id, score FROM lesson_progress WHERE assignment_id = ? AND status = ?',
            [assignmentId, 'completed']
        );
    },

    completeAssignment(assignmentId, avgScore) {
        return db.run(`
            UPDATE assignments
            SET status = 'completed', quiz_score = ?,
                completed_at = CASE WHEN completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE id = ?
        `, [avgScore, assignmentId]);
    },

    findCertificateEvidence(assignmentId, userId = null) {
        const params = userId ? [assignmentId, userId] : [assignmentId];
        return db.get(`
            SELECT a.*, u.name, u.employee_id, u.department, u.position,
                   v.title, v.category, v.training_profile, v.delivery_method,
                   v.version_no, v.pass_score, v.trainer_name, v.trainer_title,
                   v.certificate_enabled
            FROM assignments a
            JOIN users u ON a.user_id = u.id
            JOIN videos v ON a.video_id = v.id
            WHERE a.id = ? ${userId ? 'AND a.user_id = ?' : ''}
        `, params);
    },

    listCertificateLessons(assignmentId, videoId) {
        return db.all(`
            SELECT l.id, l.title, l.order_index, l.content_type,
                   m.title AS module_title, m.order_index AS module_index,
                   lp.status, lp.score, lp.watched_seconds, lp.active_seconds,
                   lp.content_progress_percent, lp.completed_at
            FROM lessons l
            LEFT JOIN training_modules m ON m.id = l.module_id
            LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.assignment_id = ?
            WHERE l.video_id = ?
            ORDER BY l.order_index ASC
        `, [assignmentId, videoId]);
    }
});

module.exports = { createEmployeeLearningRepository };
