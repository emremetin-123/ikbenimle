function createServiceRouteController(service, isAdminMode) {
    return {
        async list(req, res) {
            res.json(await service.list(req.query, !isAdminMode));
        },
        async create(req, res) {
            const id = await service.create(req.body, req.user.id);
            res.status(201).json({ success: true, id });
        },
        async update(req, res) {
            await service.update(req.params.id, req.body);
            res.json({ success: true });
        },
        async remove(req, res) {
            await service.remove(req.params.id);
            res.json({ success: true });
        }
    };
}
module.exports = { createServiceRouteController };
