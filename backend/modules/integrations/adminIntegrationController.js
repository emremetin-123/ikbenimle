const { asyncHandler } = require('../../core/http');

const createAdminIntegrationController = (service) => ({
    listConnections: asyncHandler(async (_req, res) => {
        res.json({ items: await service.listConnections() });
    }),

    createConnection: asyncHandler(async (req, res) => {
        res.status(201).json(await service.createConnection(req.body, req.user));
    }),

    updateConnection: asyncHandler(async (req, res) => {
        res.json(await service.updateConnection(req.params.id, req.body, req.user));
    }),

    listApiKeys: asyncHandler(async (req, res) => {
        res.json({ items: await service.listApiKeys(req.params.id) });
    }),

    createApiKey: asyncHandler(async (req, res) => {
        res.status(201).json(await service.createApiKey(req.params.id, req.body, req.user));
    }),

    revokeApiKey: asyncHandler(async (req, res) => {
        res.json(await service.revokeApiKey(req.params.id, req.params.keyId, req.user));
    }),

    listJobs: asyncHandler(async (req, res) => {
        res.json(await service.listJobs(req.query));
    }),

    listAuditEvents: asyncHandler(async (req, res) => {
        res.json(await service.listAuditEvents(req.query));
    })
});

module.exports = { createAdminIntegrationController };
