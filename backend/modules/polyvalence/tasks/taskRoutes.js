const { Router } = require('express');
const { z } = require('zod');
const { authenticateToken } = require('../../../middleware/auth');
const { validate } = require('../../../core/validation');
const { createTaskRepository } = require('./taskRepository');
const { createTaskService } = require('./taskService');

const positiveId = z.coerce.number().int().positive();
const taskParamsSchema = z.object({ id: positiveId }).strict();
const assessmentParamsSchema = z.object({
    taskId: positiveId,
    assessmentId: positiveId
}).strict();
const assessmentBodySchema = z.object({
    level: z.preprocess(
        value => value === '' || value === undefined ? null : value,
        z.union([z.null(), z.coerce.number().int().min(0).max(3)])
    ),
    can_train: z.union([
        z.boolean(), z.literal(0), z.literal(1), z.literal('0'), z.literal('1'),
        z.literal('true'), z.literal('false')
    ]).optional(),
    note: z.string().trim().max(4000).optional().default(''),
    version_no: z.coerce.number().int().nonnegative()
}).strict();

const route = handler => async (req, res, next) => {
    try {
        return await handler(req, res);
    } catch (error) {
        if (error?.status && error?.code) {
            return res.status(error.status).json({ error: error.code, message: error.message });
        }
        return next(error);
    }
};

const createTaskRouter = ({ db, repository }) => {
    const router = Router();
    const service = createTaskService({
        repository: createTaskRepository(db),
        taskListRepository: repository
    });

    router.get('/my-tasks/summary', authenticateToken, route(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ has_tasks: await service.hasTasks(req.user.id) });
    }));
    router.get('/my-tasks', authenticateToken, route(async (req, res) => {
        res.json(await service.listTasks(req.user.id));
    }));
    router.get('/tasks/:id', authenticateToken, validate({ params: taskParamsSchema }),
        route(async (req, res) => res.json(await service.getTask(req.user, req.params.id))));
    router.put('/tasks/:taskId/assessments/:assessmentId', authenticateToken,
        validate({ params: assessmentParamsSchema, body: assessmentBodySchema }),
        route(async (req, res) => res.json(await service.updateAssessment(
            req,
            req.params.taskId,
            req.params.assessmentId,
            req.body
        ))));
    router.post('/tasks/:id/complete', authenticateToken, validate({ params: taskParamsSchema }),
        route(async (req, res) => res.json(await service.completeTask(req, req.params.id))));

    return router;
};

module.exports = { createTaskRouter };
