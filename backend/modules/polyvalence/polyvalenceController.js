const { asyncHandler } = require('../../core/http');

function createPolyvalenceController(service, { syncMemberships } = {}) {
    return {
        setup: asyncHandler(async (req, res) => {
            if (req.query.resource === 'memberships' && syncMemberships) {
                await service.ensureUserPoolDefinitions();
                await syncMemberships({ overwrite: false });
            }
            res.json(await service.getSetup(req.query));
        })
    };
}

module.exports = { createPolyvalenceController };
