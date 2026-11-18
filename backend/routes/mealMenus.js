const express = require('express');
const multer = require('multer');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimits');
const { parseMealMenuWithGemini } = require('../services/mealMenuAiService');
const { verifyUploadSignatures } = require('../config/multer');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const schemas = require('../modules/meals/mealMenuSchemas');
const { createMealMenuRepository } = require('../modules/meals/mealMenuRepository');
const { createMealMenuService } = require('../modules/meals/mealMenuService');
const { createMealMenuController } = require('../modules/meals/mealMenuController');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => callback(
        file.mimetype === 'application/pdf' ? null : new Error('Sadece PDF dosyaları kabul edilir'),
        file.mimetype === 'application/pdf'
    )
});

module.exports = (db, mode = 'user') => {
    const router = express.Router();
    const admin = mode === 'admin';
    const controller = createMealMenuController(createMealMenuService(
        createMealMenuRepository(db),
        { parseWithAi: (buffer, month) => parseMealMenuWithGemini(buffer, month, db) }
    ));
    router.use(authenticateToken);
    if (!admin) {
        router.get('/today', asyncHandler(controller.today));
        router.get('/:date/rating', validate({ params: schemas.dateParamsSchema }), asyncHandler(controller.getRating));
        router.post('/:date/rating', validate({ params: schemas.dateParamsSchema, body: schemas.ratingBodySchema }), asyncHandler(controller.saveRating));
        router.get('/:date', validate({ params: schemas.dateParamsSchema }), asyncHandler(controller.get));
        return router;
    }
    router.use(requirePermission('manage_meal_menu'));
    router.get('/', validate({ query: schemas.monthQuerySchema }), asyncHandler(controller.list));
    router.get('/ratings/summary', validate({ query: schemas.ratingSummaryQuerySchema }), asyncHandler(controller.summary));
    router.get('/ratings', validate({ query: schemas.ratingRowsQuerySchema }), asyncHandler(controller.ratings));
    router.get('/ratings/export', validate({ query: schemas.ratingSummaryQuerySchema }), asyncHandler(controller.export));
    router.post('/parse-pdf', aiLimiter, upload.single('file'), verifyUploadSignatures, validate({ body: schemas.parsePdfBodySchema }), asyncHandler(controller.parsePdf));
    router.put('/bulk', validate({ body: schemas.bulkBodySchema }), asyncHandler(controller.bulk));
    router.delete('/:date', validate({ params: schemas.dateParamsSchema }), asyncHandler(controller.remove));
    return router;
};
