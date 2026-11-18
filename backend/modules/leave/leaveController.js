const createLeaveController = (leaveService, integrationService) => ({
    listTypes(_req, res) {
        res.json(leaveService.leaveTypes);
    },

    async getBalance(req, res) {
        res.json(await integrationService.getUserLeaveBalance(req.user.id));
    },

    async listMine(req, res) {
        res.json(await leaveService.listUserRequests(req.user.id, req.query));
    },

    async create(req, res) {
        const result = await leaveService.createRequest(req.user, req.body);
        res.status(201).json({ success: true, ...result });
    },

    async listAll(req, res) {
        res.json(await leaveService.listAllRequests(req.query));
    },

    async updateStatus(req, res) {
        res.json(await leaveService.updateStatus(
            req.params.id,
            req.body.status,
            req.user.id
        ));
    }
});

module.exports = { createLeaveController };
