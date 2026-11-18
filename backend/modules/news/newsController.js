function createNewsController(service) {
    return {
        async list(req, res) {
            res.json(await service.list(req.query));
        },
        async homePreview(_req, res) {
            res.json(await service.list({ page: 1, pageSize: 6, sort: 'created_at', order: 'desc' }));
        },
        async get(req, res) {
            res.json(await service.get(req.params.id));
        },
        async create(req, res) {
            await service.create(req.body, req.file, req.user.id);
            res.json({ success: true });
        },
        async remove(req, res) {
            await service.remove(req.params.id);
            res.json({ success: true });
        }
    };
}

module.exports = { createNewsController };
