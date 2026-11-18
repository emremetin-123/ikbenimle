const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter, loginIpLimiter } = require('../middleware/rateLimits');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const { loginSchema } = require('../modules/auth/authSchemas');
const { createAuthRepository } = require('../modules/auth/authRepository');
const { createAuthService } = require('../modules/auth/authService');
const { createAuthController } = require('../modules/auth/authController');

module.exports = (db) => {
    const router = express.Router();
    const controller = createAuthController(
        createAuthService(db, createAuthRepository(db))
    );

    router.post(
        '/login',
        loginIpLimiter,
        loginLimiter,
        validate({ body: loginSchema }),
        asyncHandler(controller.login)
    );
    router.post('/logout', authenticateToken, asyncHandler(controller.logout));
    router.post('/logout-all', authenticateToken, asyncHandler(controller.logoutAll));
    router.get('/session', authenticateToken, controller.session);

    return router;
};
