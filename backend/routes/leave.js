const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const { createLeaveRequestServiceForDb } = require('../modules/leave/leaveService');
const { createLeaveController } = require('../modules/leave/leaveController');
const {
    listQuerySchema,
    adminListQuerySchema,
    createBodySchema,
    idParamsSchema,
    statusBodySchema
} = require('../modules/leave/leaveSchemas');
const { createIntegrationRepository } = require('../modules/integrations/integrationRepository');
const { createIntegrationSyncService } = require('../modules/integrations/integrationSyncService');

module.exports = (db) => {
    const router = express.Router();
    const leaveService = createLeaveRequestServiceForDb(db);
    const integrationService = createIntegrationSyncService(
        db,
        createIntegrationRepository(db)
    );
    const controller = createLeaveController(leaveService, integrationService);

    router.get('/types', authenticateToken, controller.listTypes);

    router.get(
        '/balance',
        authenticateToken,
        asyncHandler(controller.getBalance)
    );

    router.get(
        '/',
        authenticateToken,
        validate({ query: listQuerySchema }),
        asyncHandler(controller.listMine)
    );

    router.post(
        '/',
        authenticateToken,
        validate({ body: createBodySchema }),
        asyncHandler(controller.create)
    );

    router.get(
        '/admin',
        authenticateToken,
        isAdmin,
        validate({ query: adminListQuerySchema }),
        asyncHandler(controller.listAll)
    );

    router.put(
        '/admin/:id/status',
        authenticateToken,
        isAdmin,
        validate({ params: idParamsSchema, body: statusBodySchema }),
        asyncHandler(controller.updateStatus)
    );

    return router;
};
