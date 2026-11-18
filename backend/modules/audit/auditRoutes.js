const routerFactory = require('express').Router;
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const { validate } = require('../../core/validation');
const { asyncHandler } = require('../../core/http');
const { auditQuery, auditParams, holdBody, emptyBody } = require('./auditSchemas');
const { createAuditService } = require('./auditService');
const { createAuditController } = require('./auditController');
module.exports = db => {
    const router = routerFactory();
    const controller = createAuditController(createAuditService(db));
    router.use('/audit-logs', authenticateToken, isAdmin, (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    router.get('/audit-logs', validate({ query: auditQuery }), asyncHandler(controller.list));
    router.get('/audit-logs/policy', asyncHandler(controller.policy));
    router.get('/audit-logs/export', validate({ query: auditQuery }), asyncHandler(controller.export));
    router.get('/audit-logs/:source/:id', validate({ params: auditParams }), asyncHandler(controller.detail));
    router.post('/audit-logs/:source/:id/hold', validate({ params: auditParams, body: holdBody }), asyncHandler(controller.hold));
    router.post('/audit-logs/:source/:id/release', validate({ params: auditParams, body: emptyBody }), asyncHandler(controller.release));
    return router;
};
