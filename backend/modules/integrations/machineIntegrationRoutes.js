const express = require('express');
const { validate } = require('../../core/validation');
const { integrationLimiter } = require('../../middleware/rateLimits');
const { createIntegrationAuth, requireIntegrationScope } = require('./integrationAuth');
const { createIntegrationRepository } = require('./integrationRepository');
const { createIntegrationOutboxRepository } = require('./integrationOutboxRepository');
const { createIntegrationSyncService } = require('./integrationSyncService');
const { createIntegrationDeliveryService } = require('./integrationDeliveryService');
const { createMachineIntegrationController } = require('./machineIntegrationController');
const {
    employeeBatchSchema,
    leaveBalanceBatchSchema,
    outboxQuerySchema,
    outboxParamsSchema,
    outboxAckSchema
} = require('./integrationSchemas');

module.exports = function createMachineIntegrationRoutes(db, options = {}) {
    const router = express.Router();
    const integrationRepository = createIntegrationRepository(db);
    const controller = createMachineIntegrationController(
        createIntegrationSyncService(db, integrationRepository),
        createIntegrationDeliveryService(
            createIntegrationOutboxRepository(db),
            integrationRepository
        )
    );

    router.use(createIntegrationAuth(db), integrationLimiter);
    router.use(require('./payrollRoutes')(db, options));
    router.get('/status', controller.status);
    router.post(
        '/employees/upsert',
        requireIntegrationScope('employees:write'),
        validate({ body: employeeBatchSchema }),
        controller.upsertEmployees
    );
    router.post(
        '/leave-balances/upsert',
        requireIntegrationScope('leave-balances:write'),
        validate({ body: leaveBalanceBatchSchema }),
        controller.upsertLeaveBalances
    );
    router.get(
        '/leave-requests',
        requireIntegrationScope('leave-requests:read'),
        validate({ query: outboxQuerySchema }),
        controller.claimLeaveRequests
    );
    router.post(
        '/leave-requests/:id/ack',
        requireIntegrationScope('leave-requests:ack'),
        validate({ params: outboxParamsSchema, body: outboxAckSchema }),
        controller.acknowledgeLeaveRequest
    );

    return router;
};
