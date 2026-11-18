const createTrainingRepository = db => ({
    withTransaction(work) {
        return db.transaction(tx => work(createTrainingRepository(tx)));
    },

    createModule(videoId, module) {
        return db.run(
            'INSERT INTO training_modules (video_id, title, description, order_index) VALUES (?, ?, ?, ?)',
            [videoId, module.title, module.description, module.orderIndex]
        );
    },

    createLesson(videoId, moduleId, lesson) {
        return db.run(`
            INSERT INTO lessons
                (video_id, module_id, title, url, description, content_type,
                 content_metadata, required_seconds, required_percent, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            videoId,
            moduleId,
            lesson.title,
            lesson.url,
            lesson.description,
            lesson.contentType,
            lesson.contentMetadata,
            lesson.requiredSeconds,
            lesson.requiredPercent,
            lesson.orderIndex
        ]);
    },

    createQuiz(videoId, lessonId, data) {
        return db.run(
            'INSERT INTO quizzes (video_id, lesson_id, data) VALUES (?, ?, ?)',
            [videoId, lessonId, data]
        );
    },

    findVideo(videoId) {
        return db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
    },

    listSnapshotLessons(videoId) {
        return db.all(`
            SELECT id, module_id, title, description, content_type,
                   required_seconds, required_percent, order_index
            FROM lessons
            WHERE video_id = ?
            ORDER BY order_index ASC
        `, [videoId]);
    },

    listModules(videoId) {
        return db.all(`
            SELECT id, title, description, order_index
            FROM training_modules
            WHERE video_id = ?
            ORDER BY order_index
        `, [videoId]);
    },

    findSelectedVersion(videoId) {
        return db.get(
            'SELECT id, parent_video_id, is_latest FROM videos WHERE id = ?',
            [videoId]
        );
    },

    findLatestVersion(rootId) {
        return db.get(`
            SELECT id FROM videos
            WHERE COALESCE(is_active, 1) = 1
              AND COALESCE(is_latest, 1) = 1
              AND (id = ? OR parent_video_id = ?)
            ORDER BY version_no DESC, id DESC
        `, [rootId, rootId]);
    },

    findTrainingEvidenceAssignment(assignmentId) {
        return db.get(`
            SELECT a.*, u.name, u.employee_id, u.department, u.position,
                   v.title, v.category, v.training_profile, v.delivery_method,
                   v.version_no, v.pass_score, v.minimum_watch_percent,
                   v.trainer_name, v.trainer_title, v.certificate_enabled
            FROM assignments a
            JOIN users u ON a.user_id = u.id
            JOIN videos v ON a.video_id = v.id
            WHERE a.id = ?
        `, [assignmentId]);
    },

    listTrainingEvidenceLessons(assignmentId, videoId) {
        return db.all(`
            SELECT l.id, l.title, l.order_index, l.content_type,
                   l.required_seconds, l.required_percent,
                   m.title AS module_title, m.order_index AS module_index,
                   lp.status, lp.score, lp.watched_seconds, lp.active_seconds,
                   lp.content_progress_percent, lp.page_number, lp.page_count,
                   lp.max_position, lp.last_position, lp.quiz_attempts,
                   lp.requires_rewatch, lp.completed_at
            FROM lessons l
            LEFT JOIN training_modules m ON m.id = l.module_id
            LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.assignment_id = ?
            WHERE l.video_id = ?
            ORDER BY l.order_index ASC
        `, [assignmentId, videoId]);
    },

    listTrainingAttempts(assignmentId) {
        return db.all(
            'SELECT * FROM training_attempts WHERE assignment_id = ? ORDER BY created_at ASC',
            [assignmentId]
        );
    },

    listTrainingLogs(assignmentId) {
        return db.all(
            'SELECT * FROM training_activity_logs WHERE assignment_id = ? ORDER BY created_at ASC',
            [assignmentId]
        );
    },

    listTrainingFiles(assignmentId) {
        return db.all(
            'SELECT * FROM training_evidence_files WHERE assignment_id = ? ORDER BY created_at ASC',
            [assignmentId]
        );
    },

    createAssignment(data) {
        return db.run(`
            INSERT INTO assignments
                (user_id, video_id, training_root_id, due_date, assigned_at,
                 assigned_version_no, snapshot_json, expires_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
            ON CONFLICT DO NOTHING
        `, [
            data.userId,
            data.videoId,
            data.trainingRootId,
            data.dueDate,
            data.versionNo,
            data.snapshot,
            data.expiresAt
        ]);
    },

    listExpiredCandidates(userId = null) {
        return db.all(`
            SELECT a.id, a.user_id, a.video_id, a.completed_at,
                   v.parent_video_id, v.validity_amount, v.validity_unit,
                   v.title, v.category, v.pass_score, v.version_no,
                   v.training_profile, v.delivery_method
            FROM assignments a
            JOIN videos v ON a.video_id = v.id
            WHERE a.status = 'completed'
              AND COALESCE(v.auto_reassign_enabled, 0) = 1
              AND a.completed_at IS NOT NULL
              AND COALESCE(v.validity_amount, 0) > 0
              ${userId ? 'AND a.user_id = ?' : ''}
        `, userId ? [userId] : []);
    },

    findLatestActiveVersion(rootId) {
        return db.get(`
            SELECT * FROM videos
            WHERE COALESCE(is_active, 1) = 1
              AND COALESCE(is_latest, 1) = 1
              AND (id = ? OR parent_video_id = ?)
            ORDER BY version_no DESC, id DESC
        `, [rootId, rootId]);
    },

    createExpiredReassignment(data) {
        return db.run(`
            INSERT INTO assignments
                (user_id, video_id, training_root_id, due_date, assigned_at,
                 assigned_version_no, snapshot_json, expires_at)
            SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM assignments
                WHERE user_id = ?
                  AND video_id = ?
                  AND id <> ?
                  AND assigned_at >= ?
            )
            ON CONFLICT DO NOTHING
        `, [
            data.userId,
            data.videoId,
            data.trainingRootId,
            data.expiresAt,
            data.versionNo,
            data.snapshot,
            data.expiresAt,
            data.userId,
            data.videoId,
            data.previousAssignmentId,
            data.completedAt
        ]);
    },

    async acquireLease(ownerId, lockUntil) {
        const lockName = 'expired_training_reassignment';
        const updated = await db.run(`
            UPDATE scheduler_locks
            SET owner_id = ?, lock_until = ?, updated_at = CURRENT_TIMESTAMP
            WHERE lock_name = ? AND (lock_until <= CURRENT_TIMESTAMP OR owner_id = ?)
        `, [ownerId, lockUntil, lockName, ownerId]);
        if (updated.changes) return true;
        try {
            await db.run(
                'INSERT INTO scheduler_locks (lock_name, owner_id, lock_until) VALUES (?, ?, ?)',
                [lockName, ownerId, lockUntil]
            );
            return true;
        } catch {
            return false;
        }
    }
});

module.exports = { createTrainingRepository };
