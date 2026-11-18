const express = require('express');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { validate } = require('../../core/validation');
const { createAdminIntegrationRepository } = require('./adminIntegrationRepository');
const { createIntegrationRepository } = require('./integrationRepository');
const { createAdminIntegrationService } = require('./adminIntegrationService');
const { createAdminIntegrationController } = require('./adminIntegrationController');
const {
    connectionBodySchema,
    connectionIdParamsSchema,
    keyIdParamsSchema,
    apiKeyBodySchema,
    adminListQuerySchema
} = require('./integrationSchemas');

module.exports = function createAdminIntegrationRoutes(db) {
    const router = express.Router();
    const controller = createAdminIntegrationController(
        createAdminIntegrationService(
            createAdminIntegrationRepository(db),
            createIntegrationRepository(db)
        )
    );

    router.use(authenticateToken, requirePermission('manage_integrations'));
    router.get('/integrations', controller.listConnections);
    router.post('/integrations', validate({ body: connectionBodySchema }), controller.createConnection);
    router.put(
        '/integrations/:id',
        validate({ params: connectionIdParamsSchema, body: connectionBodySchema }),
        controller.updateConnection
    );
    router.get(
        '/integrations/:id/api-keys',
        validate({ params: connectionIdParamsSchema }),
        controller.listApiKeys
    );
    router.post(
        '/integrations/:id/api-keys',
        validate({ params: connectionIdParamsSchema, body: apiKeyBodySchema }),
        controller.createApiKey
    );
    router.delete(
        '/integrations/:id/api-keys/:keyId',
        validate({ params: keyIdParamsSchema }),
        controller.revokeApiKey
    );
    router.get('/integration-jobs', validate({ query: adminListQuerySchema }), controller.listJobs);
    router.get('/integration-audit', validate({ query: adminListQuerySchema }), controller.listAuditEvents);

    return router;
};
