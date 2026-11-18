const routerFactory = require('express').Router;
const { authenticateToken } = require('../../middleware/auth');
const { asyncHandler } = require('../../core/http');
const { validate } = require('../../core/validation');
const { idParamsSchema, lessonWatchBodySchema } = require('./learningSchemas');
const { createEmployeeLearningRepository } = require('./employeeLearningRepository');
const { createEmployeeLearningService } = require('./employeeLearningService');
const { createEmployeeLearningController } = require('./employeeLearningController');

module.exports = (db, existingController = null) => {
    const router = routerFactory();
    const controller = existingController || createEmployeeLearningController(
        createEmployeeLearningService(db, createEmployeeLearningRepository(db))
    );

    router.post(
        '/lesson/:id/watch/start',
        authenticateToken,
        validate({ params: idParamsSchema }),
        asyncHandler(controller.startWatch)
    );
    router.post(
        '/lesson/:id/watch',
        authenticateToken,
        validate({ params: idParamsSchema, body: lessonWatchBodySchema }),
        asyncHandler(controller.recordWatch)
    );

    return router;
};
