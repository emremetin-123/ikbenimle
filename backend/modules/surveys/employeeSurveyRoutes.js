const routerFactory = require('express').Router;
const { authenticateToken } = require('../../middleware/auth');
const { validate } = require('../../core/validation');
const { createSurveyRepository } = require('./surveyRepository');
const { createSurveyService } = require('./surveyService');
const {
    surveyIdParamsSchema,
    employeeSurveyListQuerySchema,
    surveyResponseBodySchema
} = require('./surveySupport');

const route = handler => async (req, res, next) => {
    try {
        return await handler(req, res);
    } catch (error) {
        if (error?.status) return res.status(error.status).json({ error: error.message });
        return next(error);
    }
};

module.exports = db => {
    const router = routerFactory();
    const service = createSurveyService(createSurveyRepository(db));

    router.get('/', authenticateToken, validate({ query: employeeSurveyListQuerySchema }),
        route(async (req, res) => res.json(
            await service.listEmployeeSurveys(req.user.id, req.query)
        )));
    router.get('/:id', authenticateToken, validate({ params: surveyIdParamsSchema }),
        route(async (req, res) => res.json(
            await service.getEmployeeSurvey(req.params.id, req.user.id)
        )));
    router.post('/:id/responses', authenticateToken,
        validate({ params: surveyIdParamsSchema, body: surveyResponseBodySchema }),
        route(async (req, res) => {
            const responseId = await service.submitResponse(
                req.params.id,
                req.user.id,
                req.body.answers
            );
            return res.json({ success: true, response_id: responseId });
        }));

    return router;
};
