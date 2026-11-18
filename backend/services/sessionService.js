const crypto = require('node:crypto');

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME
    || (process.env.NODE_ENV === 'production' ? '__Host-ikbenimle_session' : 'ikbenimle_session');
const CSRF_COOKIE_NAME = 'ikbenimle_csrf';
const IDLE_TIMEOUT_MS = Number(process.env.SESSION_IDLE_MINUTES || 30) * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = Number(process.env.SESSION_ABSOLUTE_HOURS || 8) * 60 * 60 * 1000;
const WARNING_DURATION_MS = Number(process.env.SESSION_WARNING_SECONDS || 30) * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;

const randomToken = () => crypto.randomBytes(32).toString('base64url');
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_TIMEOUT_MS
};

const csrfCookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_TIMEOUT_MS
};

const parsePermissions = (value) => {
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

async function audit(db, req, eventType, success, userId = null, metadata = null) {
    try {
        const actor = userId ? await db.get('SELECT name, employee_id FROM users WHERE id = ?', [userId]) : null;
        const auditTime = new Date().toISOString().replace('T', ' ').replace('Z', '');
        await db.run(
            `INSERT INTO security_audit_events
                (user_id, event_type, success, ip_address, user_agent, metadata, actor_name, actor_employee_id, audit_created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                eventType,
                success ? 1 : 0,
                req?.ip || null,
                String(req?.get?.('user-agent') || '').slice(0, 500) || null,
                metadata ? JSON.stringify(metadata) : null,
                actor?.name || null,
                actor?.employee_id || null,
                auditTime
            ]
        );
    } catch (error) {
        console.error('Security audit event could not be recorded:', error.message);
    }
}

async function createSession(db, user, req, res) {
    const token = randomToken();
    const csrfToken = randomToken();
    const now = Date.now();
    const idleExpiresAt = new Date(now + IDLE_TIMEOUT_MS);
    const absoluteExpiresAt = new Date(now + ABSOLUTE_TIMEOUT_MS);
    const userAgentHash = hash(req.get('user-agent') || '');

    await db.transaction(async (tx) => {
        await tx.run(
            'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
            [user.id]
        );
        await tx.run(
            `INSERT INTO auth_sessions
                (token_hash, csrf_hash, user_id, idle_expires_at, absolute_expires_at, user_agent_hash, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                hash(token),
                hash(csrfToken),
                user.id,
                idleExpiresAt,
                absoluteExpiresAt,
                userAgentHash,
                req.ip || null
            ]
        );
    });

    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions);
    res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions);
    await audit(db, req, 'login_success', true, user.id);
    return {
        idleExpiresAt,
        absoluteExpiresAt
    };
}

async function loadSession(db, token, req) {
    if (!token) return null;

    const row = await db.get(`
        SELECT s.id AS auth_session_id, s.token_hash, s.csrf_hash, s.last_seen_at,
               s.idle_expires_at, s.absolute_expires_at, s.revoked_at,
               u.id, u.employee_id, u.name, u.department, u.position, u.manager_id,
               u.role, u.permissions, u.status,
               p.photo_path
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN personal_info p ON p.user_id = u.id
        WHERE s.token_hash = ?
    `, [hash(token)]);

    if (!row || row.revoked_at || row.status === 'passive') return null;

    const now = Date.now();
    if (new Date(row.idle_expires_at).getTime() <= now || new Date(row.absolute_expires_at).getTime() <= now) {
        await db.run(
            'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL',
            [row.auth_session_id]
        );
        await audit(db, req, 'session_expired', false, row.id);
        return null;
    }

    let idleExpiresAt = new Date(row.idle_expires_at);
    const absoluteExpiresAt = new Date(row.absolute_expires_at);
    const lastSeen = new Date(row.last_seen_at).getTime();
    if (!Number.isFinite(lastSeen) || now - lastSeen >= TOUCH_INTERVAL_MS) {
        const nextIdleExpiry = new Date(Math.min(now + IDLE_TIMEOUT_MS, absoluteExpiresAt.getTime()));
        await db.run(
            'UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP, idle_expires_at = ? WHERE id = ?',
            [nextIdleExpiry, row.auth_session_id]
        );
        idleExpiresAt = nextIdleExpiry;
    }

    return {
        sessionId: row.auth_session_id,
        csrfHash: row.csrf_hash,
        idleExpiresAt,
        absoluteExpiresAt,
        user: {
            id: row.id,
            employee_id: row.employee_id,
            name: row.name,
            department: row.department,
            position: row.position,
            manager_id: row.manager_id,
            role: row.role,
            permissions: parsePermissions(row.permissions),
            status: row.status,
            photo_url: row.photo_path || null
        }
    };
}

const csrfMatches = (session, csrfToken) => {
    if (!session?.csrfHash || !csrfToken) return false;
    const actual = Buffer.from(hash(csrfToken), 'hex');
    const expected = Buffer.from(session.csrfHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const getSessionPolicy = (session = null) => ({
    idle_timeout_ms: IDLE_TIMEOUT_MS,
    absolute_timeout_ms: ABSOLUTE_TIMEOUT_MS,
    warning_duration_ms: Math.min(WARNING_DURATION_MS, IDLE_TIMEOUT_MS - 1_000),
    idle_expires_at: session?.idleExpiresAt?.toISOString?.() || null,
    absolute_expires_at: session?.absoluteExpiresAt?.toISOString?.() || null
});

async function revokeSession(db, token, req, userId = null) {
    if (token) {
        await db.run(
            'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL',
            [hash(token)]
        );
    }
    await audit(db, req, 'logout', true, userId);
}

async function revokeAllSessions(db, userId, req) {
    await db.run(
        'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [userId]
    );
    await audit(db, req, 'logout_all', true, userId);
}

function clearSessionCookies(res) {
    res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    res.clearCookie(CSRF_COOKIE_NAME, { ...csrfCookieOptions, maxAge: undefined });
}

module.exports = {
    SESSION_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    audit,
    createSession,
    loadSession,
    csrfMatches,
    revokeSession,
    revokeAllSessions,
    clearSessionCookies,
    getSessionPolicy
};
