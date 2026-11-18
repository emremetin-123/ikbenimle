const routerFactory = require('express').Router;
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { validate } = require('../../core/validation');
const { createSurveyRepository } = require('./surveyRepository');
const { createSurveyService } = require('./surveyService');
const {
    surveyIdParamsSchema,
    adminSurveyListQuerySchema,
    surveyResultsQuerySchema,
    createSurveyBodySchema,
    updateSurveyStatusBodySchema
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
    router.use(authenticateToken, requirePermission('manage_surveys'));

    router.get('/', validate({ query: adminSurveyListQuerySchema }),
        route(async (req, res) => res.json(await service.listAdminSurveys(req.query))));
    router.post('/', validate({ body: createSurveyBodySchema }), route(async (req, res) => {
        const id = await service.createSurvey(req.body, req.user.id);
        return res.json({ success: true, id });
    }));
    router.put('/:id/status',
        validate({ params: surveyIdParamsSchema, body: updateSurveyStatusBodySchema }),
        route(async (req, res) => {
            await service.updateStatus(req.params.id, req.body.status);
            return res.json({ success: true });
        }));
    router.delete('/:id', validate({ params: surveyIdParamsSchema }), route(async (req, res) => {
        await service.deleteSurvey(req.params.id);
        return res.json({ success: true });
    }));
    router.get('/:id/export', validate({ params: surveyIdParamsSchema }),
        route(async (req, res) => {
            const result = await service.exportSurvey(req.params.id);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
            return res.send(result.csv);
        }));
    router.get('/:id/results',
        validate({ params: surveyIdParamsSchema, query: surveyResultsQuerySchema }),
        route(async (req, res) => res.json(await service.getResults(req.params.id, req.query))));

    return router;
};
