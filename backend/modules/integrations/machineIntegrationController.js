const { asyncHandler } = require('../../core/http');

const createMachineIntegrationController = (syncService, deliveryService) => ({
    status: asyncHandler(async (req, res) => {
        res.json({
            status: 'ok',
            contract_version: 1,
            connection: req.integration.connectionName,
            provider: req.integration.provider,
            scopes: req.integration.scopes,
            server_time: new Date().toISOString()
        });
    }),

    upsertEmployees: asyncHandler(async (req, res) => {
        const result = await syncService.upsertEmployees(
            req.integration,
            req.get('idempotency-key'),
            req.body.employees
        );
        if (result.replayed) res.setHeader('X-Idempotent-Replay', 'true');
        res.json(result.response);
    }),

    upsertLeaveBalances: asyncHandler(async (req, res) => {
        const result = await syncService.upsertLeaveBalances(
            req.integration,
            req.get('idempotency-key'),
            req.body.balances
        );
        if (result.replayed) res.setHeader('X-Idempotent-Replay', 'true');
        res.json(result.response);
    }),

    claimLeaveRequests: asyncHandler(async (req, res) => {
        res.json(await deliveryService.claim(req.integration, req.query.limit, req.id));
    }),

    acknowledgeLeaveRequest: asyncHandler(async (req, res) => {
        res.json(await deliveryService.acknowledge(
            req.integration,
            req.params.id,
            req.body,
            req.id
        ));
    })
});

module.exports = { createMachineIntegrationController };
