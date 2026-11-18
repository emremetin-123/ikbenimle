const createAdminTrainingMutationRepository = db => ({
    withTransaction(work) {
        return db.transaction(tx => work(createAdminTrainingMutationRepository(tx), tx));
    },

    createVideo(values) {
        return db.run(`
            INSERT INTO videos(
                title, description, category, pass_score, trainer_name, trainer_title, duration, validity_period,
                awards_badge, certificate_enabled, auto_reassign_enabled, validity_amount, validity_unit,
                pause_on_blur, disable_forward_seek, track_watch_seconds, quiz_attempt_limit,
                training_profile, delivery_method, is_mandatory, compliance_lock, version_no, is_latest, is_active,
                minimum_watch_percent, requires_full_watch, requires_quiz, official_documents_enabled,
                detailed_audit_enabled, cover_image_url, badge_image_url
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, values);
    },

    findVideo(videoId) {
        return db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
    },

    countActiveAssignments(videoId) {
        return db.get("SELECT COUNT(*) as count FROM assignments WHERE video_id = ? AND COALESCE(status, '') <> 'cancelled'", [videoId]);
    },

    countAssignments(videoId) {
        return db.get('SELECT COUNT(*) as count FROM assignments WHERE video_id = ?', [videoId]);
    },

    updateVideo(videoId, values) {
        return db.run(`
            UPDATE videos SET title = ?, description = ?, category = ?, pass_score = ?,
                trainer_name = ?, trainer_title = ?, duration = ?, validity_period = ?,
                awards_badge = ?, certificate_enabled = ?, auto_reassign_enabled = ?,
                validity_amount = ?, validity_unit = ?, pause_on_blur = ?, disable_forward_seek = ?,
                track_watch_seconds = ?, quiz_attempt_limit = ?, training_profile = ?, delivery_method = ?,
                is_mandatory = ?, compliance_lock = ?, minimum_watch_percent = ?, requires_full_watch = ?,
                requires_quiz = ?, official_documents_enabled = ?, detailed_audit_enabled = ?, cover_image_url = ?, badge_image_url = ?
            WHERE id = ?
        `, [...values, videoId]);
    },

    async deleteVideoContents(videoId) {
        await db.run('DELETE FROM quizzes WHERE video_id = ?', [videoId]);
        await db.run('DELETE FROM lessons WHERE video_id = ?', [videoId]);
        await db.run('DELETE FROM training_modules WHERE video_id = ?', [videoId]);
    },

    getMaxVersion(rootId) {
        return db.get('SELECT MAX(COALESCE(version_no, 1)) as max_version FROM videos WHERE id = ? OR parent_video_id = ?', [rootId, rootId]);
    },

    markVersionsNotLatest(rootId) {
        return db.run('UPDATE videos SET is_latest = 0 WHERE id = ? OR parent_video_id = ?', [rootId, rootId]);
    },

    createVersion(values, nextVersion, rootId) {
        return db.run(`
            INSERT INTO videos(
                title, description, category, pass_score, trainer_name, trainer_title, duration, validity_period,
                awards_badge, certificate_enabled, auto_reassign_enabled, validity_amount, validity_unit,
                pause_on_blur, disable_forward_seek, track_watch_seconds, quiz_attempt_limit,
                training_profile, delivery_method, is_mandatory, compliance_lock, version_no, parent_video_id,
                is_latest, is_active, minimum_watch_percent, requires_full_watch, requires_quiz,
                official_documents_enabled, detailed_audit_enabled, cover_image_url, badge_image_url
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [...values.slice(0, 21), nextVersion, rootId, 1, 1, ...values.slice(21)]);
    },

    archiveVideo(videoId) {
        return db.run('UPDATE videos SET is_active = 0 WHERE id = ?', [videoId]);
    },

    listLessonFiles(videoId) {
        return db.all('SELECT id, url FROM lessons WHERE video_id = ?', [videoId]);
    },

    async deleteVideo(videoId) {
        await db.run('DELETE FROM lesson_progress WHERE assignment_id IN (SELECT id FROM assignments WHERE video_id = ?)', [videoId]);
        await db.run('DELETE FROM assignments WHERE video_id = ?', [videoId]);
        await db.run('DELETE FROM quizzes WHERE video_id = ?', [videoId]);
        await db.run('DELETE FROM lessons WHERE video_id = ?', [videoId]);
        await db.run('DELETE FROM training_modules WHERE video_id = ?', [videoId]);
        await db.run('DELETE FROM videos WHERE id = ?', [videoId]);
    }
});

module.exports = { createAdminTrainingMutationRepository };
