const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimits');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const { createMoodRepository } = require('../modules/mood/moodRepository');
const { createMoodService } = require('../modules/mood/moodService');
const { createMoodController } = require('../modules/mood/moodController');
const {
    callbackQuerySchema,
    emptyBodySchema,
    moodBodySchema,
    reportQuerySchema,
    reportRangeSchema
} = require('../modules/mood/moodSchemas');

module.exports = db => {
    const router = express.Router();
    const controller = createMoodController(
        createMoodService(db, createMoodRepository(db))
    );

    router.use(authenticateToken);
    router.get('/today', asyncHandler(controller.today));
    router.post(
        '/',
        validate({ body: moodBodySchema }),
        asyncHandler(controller.submit)
    );
    router.post(
        '/callback-request',
        validate({ body: emptyBodySchema }),
        asyncHandler(controller.requestCallback)
    );

    router.use('/admin', requirePermission('manage_mood_analytics'));
    router.get(
        '/admin',
        validate({ query: reportQuerySchema }),
        asyncHandler(controller.report)
    );
    router.get(
        '/admin/callbacks',
        validate({ query: callbackQuerySchema }),
        asyncHandler(controller.callbacks)
    );
    router.get(
        '/admin/export',
        validate({ query: reportRangeSchema }),
        asyncHandler(controller.exportReport)
    );
    router.post(
        '/admin/analyze',
        aiLimiter,
        validate({ body: reportRangeSchema }),
        asyncHandler(controller.analyze)
    );

    return router;
};
