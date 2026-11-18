const express = require('express');
const { z } = require('zod');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const pushService = require('../../services/pushNotificationService');
const {
    generateCertificatePdf,
    generateEvidencePdf,
    generateParticipationPdf,
    generateExamPdf
} = require('../../services/trainingDocumentService');
const { validate } = require('../../core/validation');
const { sendPdf, loadTrainingEvidence } = require('./trainingService');
const { idParamsSchema, trainingAssignmentBodySchema } = require('./trainingSchemas');
const { assignTrainingUsers } = require('./trainingAssignmentService');
const { createAdminTrainingAssignmentRepository } = require('./adminTrainingAssignmentRepository');
const { createAdminTrainingAssignmentService } = require('./adminTrainingAssignmentService');

const trainingStatsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional(),
    department: z.string().trim().max(255).optional(),
    status: z.enum(['assigned', 'pending', 'completed', 'passed', 'expired', 'cancelled']).optional(),
    sort: z.enum(['assigned_at', 'name', 'title', 'due_date', 'completed_at']).default('assigned_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();
const assignmentUserOptionsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional(),
    department: z.string().trim().max(255).optional(),
    position: z.string().trim().max(255).optional()
}).strict();

module.exports = function createAdminTrainingAssignmentRoutes(db) {
    const router = express.Router();
    const service = createAdminTrainingAssignmentService(
        createAdminTrainingAssignmentRepository(db)
    );

    router.get('/stats', authenticateToken, requirePermission('manage_education'), validate({ query: trainingStatsQuerySchema }), async (req, res, next) => {
        try {
            res.json(await service.listStats(req.query));
        } catch (error) {
            next(error);
        }
    });

    router.get('/stats/options', authenticateToken, requirePermission('manage_education'), async (_req, res, next) => {
        try {
            res.json(await service.getStatsOptions());
        } catch (error) {
            next(error);
        }
    });

    router.get('/assignment-user-filters', authenticateToken, requirePermission('manage_education'), async (_req, res, next) => {
        try {
            res.json(await service.getUserFilters());
        } catch (error) {
            next(error);
        }
    });

    router.get('/assignment-user-options', authenticateToken, requirePermission('manage_education'), validate({ query: assignmentUserOptionsQuerySchema }), async (req, res, next) => {
        try {
            res.json(await service.listUserOptions(req.query));
        } catch (error) {
            next(error);
        }
    });

    router.post('/assign', authenticateToken, requirePermission('manage_education'), validate({ body: trainingAssignmentBodySchema }), async (req, res) => {
        const { user_ids, video_id, due_date } = req.body;
        if (!user_ids?.length) return res.status(400).json({ error: 'Atanacak kullanıcı seçilmedi' });
        if (!video_id) return res.status(400).json({ error: 'Eğitim seçilmedi' });

        try {
            const assignmentResult = await assignTrainingUsers(db, {
                userIds: user_ids,
                videoId: video_id,
                dueDate: due_date
            });
            if (!assignmentResult) return res.status(404).json({ error: 'Egitim bulunamadi' });
            pushService.sendTemplatedToUsers(db, assignmentResult.created, 'training_assigned', {
                trainingTitle: assignmentResult.video?.title || 'Yeni eğitim',
                dueDate: due_date || '',
                title: 'Yeni eğitim atandı',
                body: assignmentResult.video?.title ? `${assignmentResult.video.title} eğitimi size atandı.` : 'Size yeni bir eğitim atandı.',
                url: '/employee/egitimler',
                tag: `training-${assignmentResult.videoId}`
            }).catch(err => console.error('Training assignment push error:', err.message));
            res.json({
                success: true,
                created: assignmentResult.created.length,
                skipped: assignmentResult.skipped.length
            });
        } catch (err) {
            console.error('Assignment error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    router.delete('/assignments/:id', authenticateToken, requirePermission('manage_education'), validate({ params: idParamsSchema }), async (req, res, next) => {
        try {
            await service.cancelAssignment(req.params.id, req.user.id);
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    });

    router.get('/assignments/:id/evidence', authenticateToken, requirePermission('manage_education'), validate({ params: idParamsSchema }), async (req, res) => {
        try {
            const evidence = await loadTrainingEvidence(db, req.params.id);
            if (!evidence) return res.status(404).json({ error: 'Atama bulunamadi' });
            res.json(evidence);
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    router.get('/assignments/:id/evidence.pdf', authenticateToken, requirePermission('manage_education'), validate({ params: idParamsSchema }), async (req, res) => {
        try {
            const evidence = await loadTrainingEvidence(db, req.params.id);
            if (!evidence) return res.status(404).json({ error: 'Atama bulunamadi' });
            const buffer = await generateEvidencePdf(evidence);
            sendPdf(res, buffer, `Egitim_Kanit_Raporu_${req.params.id}.pdf`);
        } catch (err) {
            console.error('Training evidence PDF error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    router.get('/assignments/:id/certificate.pdf', authenticateToken, requirePermission('manage_education'), validate({ params: idParamsSchema }), async (req, res) => {
        try {
            const evidence = await loadTrainingEvidence(db, req.params.id);
            if (!evidence) return res.status(404).json({ error: 'Atama bulunamadi' });
            if (!evidence.assignment.reference_id) {
                return res.status(400).json({ error: 'Bu atama icin sertifika referansi olusmamis' });
            }
            const publicBaseUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
            const verifyUrl = `${publicBaseUrl.replace(/\/+$/, '')}/api/certificates/${encodeURIComponent(evidence.assignment.reference_id)}/verify`;
            const buffer = await generateCertificatePdf({ ...evidence, verifyUrl });
            sendPdf(res, buffer, `Sertifika_${evidence.assignment.reference_id}.pdf`);
        } catch (err) {
            console.error('Certificate PDF error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    router.get('/assignments/:id/participation.pdf', authenticateToken, requirePermission('manage_education'), validate({ params: idParamsSchema }), async (req, res) => {
        try {
            const evidence = await loadTrainingEvidence(db, req.params.id);
            if (!evidence) return res.status(404).json({ error: 'Atama bulunamadi' });
            const buffer = await generateParticipationPdf(evidence);
            sendPdf(res, buffer, `Katilim_Raporu_${req.params.id}.pdf`);
        } catch (err) {
            console.error('Participation PDF error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    router.get('/assignments/:id/exam.pdf', authenticateToken, requirePermission('manage_education'), validate({ params: idParamsSchema }), async (req, res) => {
        try {
            const evidence = await loadTrainingEvidence(db, req.params.id);
            if (!evidence) return res.status(404).json({ error: 'Atama bulunamadi' });
            const buffer = await generateExamPdf(evidence);
            sendPdf(res, buffer, `Sinav_Raporu_${req.params.id}.pdf`);
        } catch (err) {
            console.error('Exam PDF error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    return router;
};
