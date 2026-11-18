function createMealMenuController(service) {
    return {
        async today(_req, res) { res.json(await service.getMenu()); },
        async get(req, res) { res.json(await service.getMenu(req.params.date)); },
        async getRating(req, res) { res.json(await service.getRating(req.params.date, req.user.id)); },
        async saveRating(req, res) {
            res.json({ success: true, rating: await service.saveRating(req.params.date, req.user.id, req.body) });
        },
        async list(req, res) { res.json(await service.listMenus(req.query)); },
        async summary(req, res) { res.json(await service.ratingSummary(req.query.month)); },
        async ratings(req, res) { res.json(await service.listRatings(req.query)); },
        async export(req, res) {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="yemek-menu-degerlendirme-${req.query.month}.csv"`);
            res.send(await service.exportRatings(req.query.month));
        },
        async parsePdf(req, res) { res.json(await service.parsePdf(req.file, req.body.month)); },
        async bulk(req, res) {
            res.json({ success: true, saved: await service.saveMenus(req.body, req.user.id) });
        },
        async remove(req, res) { await service.remove(req.params.date); res.json({ success: true }); }
    };
}
module.exports = { createMealMenuController };
