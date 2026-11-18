function createReminderController(service) {
    return {
        async list(req, res) {
            res.json({ items: await service.list(req.user.id) });
        },
        async create(req, res) {
            res.status(201).json(await service.create(req.user.id, req.body.text));
        },
        async update(req, res) {
            res.json(await service.update(req.params.id, req.user.id, req.body));
        },
        async remove(req, res) {
            await service.remove(req.params.id, req.user.id);
            res.json({ success: true });
        }
    };
}

module.exports = { createReminderController };
