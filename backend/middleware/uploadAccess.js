const publicFolders = new Set(['avatars', 'news', 'announcements']);

const hasPermission = (user, permission) => (
    user?.role === 'admin' || user?.permissions?.includes(permission)
);

const storedPath = (req) => {
    const pathname = String(req.originalUrl || '').split('?')[0];
    return pathname.startsWith('/uploads/') ? decodeURIComponent(pathname) : '';
};

const authorizeUpload = (db) => async (req, res, next) => {
    try {
        const relativePath = String(req.path || '').replace(/^\/+/, '');
        const folder = relativePath.split('/')[0];
        const filePath = storedPath(req);
        if (!filePath) return res.status(404).json({ error: 'FILE_NOT_FOUND' });
        if (publicFolders.has(folder)) return next();

        if (folder === 'documents') {
            if (hasPermission(req.user, 'manage_documents')) return next();
            const owned = await db.get(
                `SELECT user_id FROM documents WHERE file_path = ?
                 UNION ALL
                 SELECT user_id FROM document_requests WHERE response_file_path = ?`,
                [filePath, filePath]
            );
            return Number(owned?.user_id) === Number(req.user.id)
                ? next()
                : res.status(403).json({ error: 'FILE_ACCESS_DENIED' });
        }

        if (folder === 'feedback') {
            if (hasPermission(req.user, 'manage_feedback')) return next();
            const feedback = await db.get(
                `SELECT id, user_id, assigned_to_user_id
                 FROM feedback
                 WHERE file_path = ?`,
                [filePath]
            );
            if (!feedback) return res.status(404).json({ error: 'FILE_NOT_FOUND' });
            if (
                Number(feedback.user_id) === Number(req.user.id)
                || Number(feedback.assigned_to_user_id) === Number(req.user.id)
            ) return next();
            const participant = await db.get(
                'SELECT id FROM feedback_participants WHERE feedback_id = ? AND user_id = ?',
                [feedback.id, req.user.id]
            );
            return participant
                ? next()
                : res.status(403).json({ error: 'FILE_ACCESS_DENIED' });
        }

        if (folder === 'videos') {
            if (hasPermission(req.user, 'manage_education')) return next();
            const earnedBadge = await db.get(
                `SELECT v.id FROM videos v
                 JOIN assignments a ON a.video_id = v.id
                 JOIN users u ON u.id = a.user_id
                 WHERE v.badge_image_url = ? AND COALESCE(v.awards_badge, 1) = 1
                   AND a.status = 'completed' AND (u.status IS NULL OR u.status = 'active')`,
                [filePath]
            );
            if (earnedBadge) return next();
            const assignment = await db.get(
                `SELECT a.id
                 FROM assignments a
                 JOIN videos v ON v.id = a.video_id
                 LEFT JOIN lessons l ON l.video_id = v.id
                 WHERE a.user_id = ?
                   AND COALESCE(a.status, '') <> 'cancelled'
                   AND (v.cover_image_url = ? OR v.badge_image_url = ? OR v.url = ? OR l.url = ?)`,
                [req.user.id, filePath, filePath, filePath, filePath]
            );
            return assignment
                ? next()
                : res.status(403).json({ error: 'FILE_ACCESS_DENIED' });
        }

        return res.status(403).json({ error: 'FILE_ACCESS_DENIED' });
    } catch (error) {
        next(error);
    }
};

module.exports = { authorizeUpload };
