const bcrypt = require('bcryptjs');
const { AppError } = require('../../core/http');
const {
    assertLoginAllowed,
    recordLoginFailure,
    clearAccountLoginGuard
} = require('../../services/loginGuardService');
const {
    audit,
    createSession,
    revokeSession,
    revokeAllSessions,
    clearSessionCookies,
    getSessionPolicy
} = require('../../services/sessionService');

const publicUser = (user, session = null) => ({
    id: user.id,
    role: user.role,
    name: user.name,
    employee_id: user.employee_id,
    department: user.department,
    position: user.position,
    manager_id: user.manager_id,
    status: user.status || 'active',
    permissions: user.permissions,
    photo_url: user.photo_path || user.photo_url || null,
    session_policy: getSessionPolicy(session)
});

const authenticationError = () => new AppError(
    401,
    'AUTHENTICATION_FAILED',
    'Kullanıcı bilgileri doğrulanamadı.'
);

function createAuthService(db, repository) {
    return {
        async login({ employeeId, password, req, res }) {
            const guard = await assertLoginAllowed(db, req, employeeId);
            if (!guard.allowed) {
                await audit(db, req, 'login_failed', false, null, {
                    reason: 'guard_rejected'
                });
                throw authenticationError();
            }
            const user = await repository.findByEmployeeId(employeeId);
            const validPassword = user && typeof user.password_hash === 'string' && user.password_hash
                ? await bcrypt.compare(password, user.password_hash)
                : false;
            if (!user || !validPassword || user.status === 'passive') {
                await recordLoginFailure(db, guard.keys);
                await audit(db, req, 'login_failed', false, user?.id || null, {
                    reason: user?.status === 'passive'
                        ? 'inactive'
                        : 'invalid_credentials'
                });
                throw authenticationError();
            }
            await clearAccountLoginGuard(db, guard.keys);
            const session = await createSession(db, user, req, res);
            return publicUser(user, session);
        },
        async logout(req, res) {
            await revokeSession(db, req.sessionToken, req, req.user.id);
            clearSessionCookies(res);
        },
        async logoutAll(req, res) {
            await revokeAllSessions(db, req.user.id, req);
            clearSessionCookies(res);
        },
        getSession(user, session) {
            return publicUser(user, session);
        }
    };
}

module.exports = { createAuthService };
