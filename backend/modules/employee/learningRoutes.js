const routerFactory = require('express').Router;
const { authenticateToken } = require('../../middleware/auth');
const { validate } = require('../../core/validation');
const { asyncHandler } = require('../../core/http');
const { idParamsSchema, lessonQuizBodySchema } = require('./learningSchemas');
const { employeeTrainingListQuerySchema } = require('./employeeTrainingService');
const { createEmployeeLearningRepository } = require('./employeeLearningRepository');
const { createEmployeeLearningService } = require('./employeeLearningService');
const { createEmployeeLearningController } = require('./employeeLearningController');
const createLearningProgressRoutes = require('./learningProgressRoutes');

module.exports = db => {
    const router = routerFactory();
    const controller = createEmployeeLearningController(
        createEmployeeLearningService(db, createEmployeeLearningRepository(db))
    );

    router.use(createLearningProgressRoutes(db, controller));
    router.get('/videos/summary', authenticateToken, asyncHandler(controller.summary));
    router.get(
        '/videos',
        authenticateToken,
        validate({ query: employeeTrainingListQuerySchema }),
        asyncHandler(controller.list)
    );
    router.get(
        '/video/:id',
        authenticateToken,
        validate({ params: idParamsSchema }),
        controller.detail
    );
    router.post(
        '/lesson/:id/quiz',
        authenticateToken,
        validate({ params: idParamsSchema, body: lessonQuizBodySchema }),
        controller.submitQuiz
    );
    router.post(
        '/assignment/:id/confirm',
        authenticateToken,
        validate({ params: idParamsSchema }),
        controller.confirmAssignment
    );

    return router;
};
