const crypto = require('node:crypto');

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;
const MAX_FAILURES = 10;

const hash = (value) => crypto.createHash('sha256')
    .update(String(value || '').trim().toLowerCase())
    .digest('hex');

const keysFor = (req, employeeId) => ({
    account: hash(`account:${employeeId}`),
    ip: hash(`ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`)
});

const getGuard = (db, keyHash) => db.get(
    `SELECT key_hash, failed_count, window_started_at, locked_until
     FROM auth_login_guards WHERE key_hash = ?`,
    [keyHash]
);

const isLocked = (guard, now = Date.now()) => Boolean(
    guard?.locked_until && new Date(guard.locked_until).getTime() > now
);

const assertLoginAllowed = async (db, req, employeeId) => {
    const keys = keysFor(req, employeeId);
    const [accountGuard, ipGuard] = await Promise.all([
        getGuard(db, keys.account),
        getGuard(db, keys.ip)
    ]);
    return {
        allowed: !isLocked(accountGuard) && !isLocked(ipGuard),
        keys
    };
};

const recordFailureForKey = async (db, keyHash, guardType, now) => {
    const nowIso = new Date(now).toISOString();
    const windowBoundary = new Date(now - WINDOW_MS).toISOString();
    const lockedUntil = new Date(now + LOCK_MS).toISOString();
    await db.run(
        `INSERT INTO auth_login_guards
            (key_hash, guard_type, failed_count, window_started_at, locked_until)
         VALUES (?, ?, 1, ?, NULL)
         ON CONFLICT(key_hash) DO UPDATE SET
            guard_type = excluded.guard_type,
            failed_count = CASE
                WHEN auth_login_guards.window_started_at >= ?
                THEN auth_login_guards.failed_count + 1 ELSE 1 END,
            window_started_at = CASE
                WHEN auth_login_guards.window_started_at >= ?
                THEN auth_login_guards.window_started_at ELSE ? END,
            locked_until = CASE
                WHEN (CASE
                    WHEN auth_login_guards.window_started_at >= ?
                    THEN auth_login_guards.failed_count + 1 ELSE 1 END) >= ?
                THEN ? ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP`,
        [
            keyHash, guardType, nowIso,
            windowBoundary, windowBoundary, nowIso,
            windowBoundary, MAX_FAILURES, lockedUntil
        ]
    );
};

const recordLoginFailure = async (db, keys) => {
    const now = Date.now();
    await db.transaction(async tx => {
        await recordFailureForKey(tx, keys.account, 'account', now);
        await recordFailureForKey(tx, keys.ip, 'ip', now);
    });
};

const clearLoginGuard = (db, keys) => db.run(
    'DELETE FROM auth_login_guards WHERE key_hash IN (?, ?)',
    [keys.account, keys.ip]
);

const clearAccountLoginGuard = (db, keys) => db.run(
    'DELETE FROM auth_login_guards WHERE key_hash = ?',
    [keys.account]
);

module.exports = {
    assertLoginAllowed,
    recordLoginFailure,
    clearLoginGuard,
    clearAccountLoginGuard,
    constants: { WINDOW_MS, LOCK_MS, MAX_FAILURES }
};
