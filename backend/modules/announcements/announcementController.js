function createAnnouncementController(service) {
    return {
        async list(req, res) {
            res.json(await service.list(req.query, {
                admin: req.baseUrl.includes('/admin/'),
                userId: req.user.id
            }));
        },
        async homePreview(req, res) {
            res.json(await service.list({ page: 1, pageSize: 3, sort: 'created_at', order: 'desc' }, {
                admin: false,
                userId: req.user.id
            }));
        },
        async listDepartments(_req, res) {
            res.json(await service.listDepartments());
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

module.exports = { createAnnouncementController };
