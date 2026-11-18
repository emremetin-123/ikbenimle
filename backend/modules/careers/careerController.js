function createCareerController(service) {
    return {
        async listJobs(req, res) { res.json(await service.listJobs(req.query, { activeOnly: true, includeCounts: false })); },
        async getJob(req, res) { res.json(await service.getJob(req.params.id, req.user.id)); },
        async apply(req, res) {
            await service.apply(req.params.id, req.user.id);
            res.json({ success: true, message: 'Başvurunuz başarıyla alındı.' });
        },
        async listMine(req, res) { res.json(await service.listMine(req.user.id, req.query)); },
        async listAdminJobs(req, res) { res.json(await service.listJobs(req.query, { activeOnly: false, includeCounts: true })); },
        async createJob(req, res) { res.json({ success: true, id: await service.createJob(req.body, req.user.id) }); },
        async updateJob(req, res) { await service.updateJob(req.params.id, req.body); res.json({ success: true }); },
        async deleteJob(req, res) { await service.deleteJob(req.params.id); res.json({ success: true }); },
        async listApplications(req, res) { res.json(await service.listApplications(req.params.id, req.query)); },
        async updateApplicationStatus(req, res) {
            await service.updateApplicationStatus(req.params.id, req.body.status);
            res.json({ success: true });
        }
    };
}
module.exports = { createCareerController };
