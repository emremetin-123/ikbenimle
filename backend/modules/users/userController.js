const { asyncHandler } = require('../../core/http');

const createUserController = (service) => ({
    list: asyncHandler(async (req, res) => {
        res.json(await service.list(req.query));
    }),

    options: asyncHandler(async (req, res) => {
        res.json(await service.listOptions(req.query));
    }),

    formOptions: asyncHandler(async (_req, res) => {
        res.json(await service.listFormOptions());
    })
});

module.exports = {
    createUserController
};
