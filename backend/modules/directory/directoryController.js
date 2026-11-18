function createDirectoryController(service) {
    return {
        async list(req, res) {
            res.json(await service.list(req.query));
        },
        async listBirthdays(req, res) {
            res.json(await service.listBirthdays(req.query));
        },
        async getProfile(req, res) {
            res.json(await service.getProfile(req.params.id, req.user));
        }
    };
}

module.exports = { createDirectoryController };
