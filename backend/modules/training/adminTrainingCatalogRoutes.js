const express = require('express');
const { z } = require('zod');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { validate } = require('../../core/validation');
const { createAdminTrainingCatalogRepository } = require('./adminTrainingCatalogRepository');
const { createAdminTrainingCatalogService } = require('./adminTrainingCatalogService');

const trainingVideoListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional(),
    category: z.string().trim().max(255).optional(),
    profile: z.string().trim().max(100).optional(),
    sort: z.enum(['id', 'title', 'category', 'training_profile']).default('id'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();
const optionListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional()
}).strict();

module.exports = function createAdminTrainingCatalogRoutes(db) {
    const router = express.Router();
    const service = createAdminTrainingCatalogService(createAdminTrainingCatalogRepository(db));

    router.get('/all-videos', authenticateToken, requirePermission('manage_education'), validate({ query: trainingVideoListQuerySchema }), async (req, res, next) => {
        try {
            res.json(await service.listVideos(req.query));
        } catch (error) {
            next(error);
        }
    });

    router.get('/all-videos/options', authenticateToken, requirePermission('manage_education'), validate({ query: optionListQuerySchema }), async (req, res, next) => {
        try {
            res.json(await service.listOptions(req.query));
        } catch (error) {
            next(error);
        }
    });

    router.get('/video/:id', authenticateToken, requirePermission('manage_education'), async (req, res) => {
        try {
            const result = await service.getVideo(req.params.id);
            if (!result) return res.status(404).json({ error: 'Egitim bulunamadi' });
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    return router;
};
