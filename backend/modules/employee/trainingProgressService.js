const crypto = require('node:crypto');
const { AppError } = require('../../core/http');

const HEARTBEAT_MAX_SECONDS = 20;
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const enabled = value => value === true || value === 1 || value === '1';
const asDateMs = value => value ? new Date(value).getTime() : 0;
const enforcementMode = () => (
    String(process.env.TRAINING_PROGRESS_ENFORCEMENT || 'enforce').toLowerCase() === 'observe'
        ? 'observe'
        : 'enforce'
);

const calculateLegacyProgress = (lesson, body) => {
    const duration = Math.max(0, Math.round(Number(body.duration_seconds || 0)));
    const maxPosition = Math.max(Number(body.last_position || 0), Number(body.max_position || 0));
    const watchPercent = duration > 0
        ? Math.round((Math.min(maxPosition, duration) / duration) * 100)
        : (body.video_completed ? 100 : 0);
    return {
        satisfied: !enabled(lesson.requires_full_watch)
            || Boolean(body.video_completed)
            || watchPercent >= Number(lesson.minimum_watch_percent || 100),
        watchPercent
    };
};

const startSession = async (db, { assignmentId, lessonId, userId, position = 0 }) => {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString();
    await db.transaction(async tx => {
        const progress = await tx.get(
            `SELECT id, requires_rewatch, last_position
             FROM lesson_progress WHERE assignment_id = ? AND lesson_id = ?`,
            [assignmentId, lessonId]
        );
        let sessionPosition = Math.max(0, Number(position || 0));
        if (progress?.requires_rewatch) {
            await tx.run(
                `UPDATE lesson_progress
                 SET status = 'assigned', server_active_seconds = 0,
                     watched_seconds = 0, active_seconds = 0, max_position = 0, last_position = 0
                 WHERE id = ?`,
                [progress.id]
            );
            sessionPosition = 0;
        } else {
            sessionPosition = Math.max(sessionPosition, Number(progress?.last_position || 0));
        }
        const updated = await tx.run(
            `UPDATE training_progress_sessions
             SET user_id = ?, token_hash = ?, started_at = ?, last_heartbeat_at = ?,
                 last_position = ?, duration_seconds = 0, expires_at = ?
             WHERE assignment_id = ? AND lesson_id = ?`,
            [userId, hashToken(token), now.toISOString(), now.toISOString(), sessionPosition, expiresAt, assignmentId, lessonId]
        );
        if (!updated.changes) {
            await tx.run(
                `INSERT INTO training_progress_sessions
                    (assignment_id, lesson_id, user_id, token_hash, started_at,
                     last_heartbeat_at, last_position, duration_seconds, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
                [assignmentId, lessonId, userId, hashToken(token), now.toISOString(), now.toISOString(), sessionPosition, expiresAt]
            );
        }
    });
    return { progress_token: token, expires_at: expiresAt };
};

const recordVideoProgress = async (db, { assignment, lesson, userId, body }) => db.transaction(async tx => {
    const mode = enforcementMode();
    const lockClause = process.env.DB_TYPE === 'postgres' ? ' FOR UPDATE' : '';
    const session = body.progress_token
        ? await tx.get(
            `SELECT * FROM training_progress_sessions
             WHERE assignment_id = ? AND lesson_id = ? AND user_id = ? AND token_hash = ?${lockClause}`,
            [assignment.id, lesson.id, userId, hashToken(body.progress_token)]
        )
        : null;
    if ((!session || asDateMs(session.expires_at) <= Date.now()) && mode === 'enforce') {
        throw new AppError(409, 'PROGRESS_SESSION_REQUIRED', 'Eğitim ilerleme oturumu yenilenmelidir.');
    }

    const existing = await tx.get(
        `SELECT id, status, watched_seconds, active_seconds, server_active_seconds,
                max_position, requires_rewatch, quiz_attempts
         FROM lesson_progress WHERE assignment_id = ? AND lesson_id = ?${lockClause}`,
        [assignment.id, lesson.id]
    );
    const submittedPosition = Math.max(0, Number(body.last_position || 0));
    const submittedMax = Math.max(submittedPosition, Number(body.max_position || 0));
    const submittedDuration = Math.max(0, Math.round(Number(body.duration_seconds || 0)));
    let acceptedPosition = submittedPosition;
    let serverActive = Number(existing?.server_active_seconds || 0);
    let lockedDuration = Number(session?.duration_seconds || 0);

    if (session) {
        const elapsed = Math.max(0, Math.min(
            HEARTBEAT_MAX_SECONDS,
            Math.round((Date.now() - asDateMs(session.last_heartbeat_at)) / 1000)
        ));
        const previousPosition = Math.max(0, Number(session.last_position || 0));
        const advance = Math.max(0, submittedPosition - previousPosition);
        const implausibleSeek = enabled(lesson.disable_forward_seek)
            && advance > (elapsed * 1.5) + 2;
        if (implausibleSeek) acceptedPosition = previousPosition;
        const credited = body.is_playing && !implausibleSeek && advance > 0
            ? Math.min(elapsed, Math.ceil(advance) + 1)
            : 0;
        serverActive += credited;
        if (!lockedDuration && submittedDuration > 0) lockedDuration = submittedDuration;
        await tx.run(
            `UPDATE training_progress_sessions
             SET last_heartbeat_at = ?, last_position = ?, duration_seconds = ?
             WHERE id = ?`,
            [new Date().toISOString(), acceptedPosition, lockedDuration, session.id]
        );
    }

    const requiredPercent = Math.max(0, Number(lesson.minimum_watch_percent || 100));
    const trustedDuration = Math.max(0, Number(lesson.required_seconds || 0));
    const requiredSeconds = Math.ceil(trustedDuration * (requiredPercent / 100));
    const acceptedMax = Math.max(Number(existing?.max_position || 0), Math.min(submittedMax, acceptedPosition));
    const secureSatisfied = !enabled(lesson.requires_full_watch)
        || (trustedDuration > 0 && serverActive >= requiredSeconds && acceptedMax >= requiredSeconds);
    const legacy = calculateLegacyProgress(lesson, body);
    const satisfied = mode === 'observe' ? legacy.satisfied : secureSatisfied;
    const watchPercent = trustedDuration > 0
        ? Math.min(100, Math.round((acceptedMax / trustedDuration) * 100))
        : (mode === 'observe' ? legacy.watchPercent : 0);
    const quizRequired = Boolean(lesson.has_quiz);
    const status = satisfied ? (quizRequired ? 'watched' : 'completed') : 'assigned';

    if (existing) {
        await tx.run(
            `UPDATE lesson_progress
             SET status = CASE WHEN status = 'completed' THEN 'completed' ELSE ? END,
                 watched_seconds = CASE WHEN ? > COALESCE(watched_seconds, 0) THEN ? ELSE watched_seconds END,
                 active_seconds = CASE WHEN ? > COALESCE(active_seconds, 0) THEN ? ELSE active_seconds END,
                 server_active_seconds = ?,
                 content_progress_percent = CASE WHEN ? > COALESCE(content_progress_percent, 0) THEN ? ELSE content_progress_percent END,
                 max_position = CASE WHEN ? > COALESCE(max_position, 0) THEN ? ELSE max_position END,
                 last_position = ?,
                 requires_rewatch = CASE WHEN ? = 1 THEN 0 ELSE COALESCE(requires_rewatch, 0) END,
                 quiz_attempts = CASE WHEN ? = 1 AND COALESCE(requires_rewatch, 0) = 1 THEN 0 ELSE COALESCE(quiz_attempts, 0) END,
                 completed_at = CASE WHEN ? = 'completed' AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END
             WHERE id = ?`,
            [status, acceptedMax, acceptedMax, serverActive, serverActive, serverActive,
                watchPercent, watchPercent, acceptedMax, acceptedMax, acceptedPosition,
                satisfied ? 1 : 0, satisfied ? 1 : 0, status, existing.id]
        );
    } else {
        await tx.run(
            `INSERT INTO lesson_progress
                (assignment_id, lesson_id, status, watched_seconds, active_seconds,
                 server_active_seconds, content_progress_percent, max_position, last_position,
                 requires_rewatch, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0,
                     CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
            [assignment.id, lesson.id, status, acceptedMax, serverActive, serverActive,
                watchPercent, acceptedMax, acceptedPosition, status]
        );
    }
    return { status, watchPercent, serverActive, secureSatisfied, mode };
});

module.exports = {
    HEARTBEAT_MAX_SECONDS,
    recordVideoProgress,
    startSession
};
