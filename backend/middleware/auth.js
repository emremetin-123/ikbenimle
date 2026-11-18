const {
    SESSION_COOKIE_NAME,
    loadSession,
    csrfMatches,
    clearSessionCookies
} = require('../services/sessionService');

let authDb = null;

const setAuthDatabase = (db) => {
    authDb = db;
};

const isMutation = (method) => !['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase());

const authenticateToken = async (req, res, next) => {
    if (!authDb) return res.status(503).json({ error: 'AUTH_NOT_READY' });

    try {
        const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
        const session = await loadSession(authDb, rawToken, req);
        if (!session) {
            clearSessionCookies(res);
            return res.status(401).json({ error: 'SESSION_EXPIRED' });
        }

        req.user = session.user;
        if (req.auditStart) await req.auditStart(req.user);

        if (isMutation(req.method)) {
            const csrfToken = req.get('x-csrf-token');
            if (!csrfMatches(session, csrfToken)) {
                return res.status(403).json({ error: 'CSRF_VALIDATION_FAILED' });
            }
        }

        req.authSessionId = session.sessionId;
        req.authSession = session;
        req.sessionToken = rawToken;
        next();
    } catch (error) {
        next(error);
    }
};

const isAdmin = (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ error: 'ADMIN_ACCESS_REQUIRED' });
};

const getPermissions = (user) => {
    if (Array.isArray(user?.permissions)) return user.permissions;
    try {
        const parsed = JSON.parse(user?.permissions || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const hasAdminPanelAccess = (user) => {
    const permissions = getPermissions(user);
    return user?.role === 'admin' || permissions.some((permission) => permission.startsWith('manage_'));
};

const requirePermission = (permission) => (req, res, next) => {
    const permissions = getPermissions(req.user);
    if (req.user?.role === 'admin' || permissions.includes(permission)) return next();
    return res.status(403).json({ error: 'PERMISSION_REQUIRED', permission });
};

module.exports = {
    authenticateToken,
    isAdmin,
    requirePermission,
    hasAdminPanelAccess,
    setAuthDatabase
};
