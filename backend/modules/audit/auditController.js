const createAuditController = service => ({
    list: async (req, res) => res.json(await service.list(req.query, req.auditEventId)),
    detail: async (req, res) => res.json(await service.detail(req.params.source, req.params.id)),
    policy: async (_req, res) => res.json(await service.policy()),
    hold: async (req, res) => res.json(await service.hold(req.params.source, req.params.id, req.user, req.body.reason)),
    release: async (req, res) => res.json(await service.release(req.params.source, req.params.id)),
    export: async (req, res) => {
        const content = await service.export(req.query, req.auditEventId);
        res.setHeader('Content-Disposition', 'attachment; filename="log-kayitlari.csv"');
        res.type('text/csv; charset=utf-8').send(content);
    }
});
module.exports = { createAuditController };
