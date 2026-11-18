const { Router } = require('express');
const { z } = require('zod');
const { AppError } = require('../../../core/http');
const { validate } = require('../../../core/validation');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const { createScheduleRouter } = require('../scheduling/scheduleRoutes');
const { createPeriodRepository } = require('./periodRepository');
const { createPeriodService } = require('./periodService');

const MANAGE_PERMISSION = 'manage_polyvalence';
const positiveId = z.coerce.number().int().positive();
const idParamsSchema = z.object({ id: positiveId }).strict();
const levelParamsSchema = z.object({
    level: z.coerce.number().int().min(0).max(3)
}).strict();
const levelBodySchema = z.object({
    label: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).nullish(),
    color: z.string().trim().max(50).nullish()
}).strict();
const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const createPeriodBodySchema = z.object({
    department_id: positiveId,
    name: z.string().trim().min(1).max(255),
    start_date: dateSchema,
    end_date: dateSchema,
    due_date: dateSchema
}).strict();
const closeBodySchema = z.object({
    override_reason: z.string().trim().max(2000).optional().default('')
}).strict().default({});
const reasonBodySchema = z.object({
    reason: z.string().trim().min(1).max(2000)
}).strict();

const route = (handler) => async (req, res, next) => {
    try {
        return await handler(req, res);
    } catch (error) {
        return next(error);
    }
};

const createPeriodRouter = ({
    db,
    ensureAdminReport,
    canManage,
    loadReportScopeDepartment,
    addAudit,
    toBool,
    dateKey,
    addMonths,
    addDays,
    buildPeriodName,
    syncMemberships
}) => {
    const router = Router();
    const repository = createPeriodRepository(db);
    const service = createPeriodService({
        db,
        repository,
        addAudit,
        toBool,
        dateKey,
        addMonths,
        addDays,
        buildPeriodName,
        syncMemberships
    });

    router.use(createScheduleRouter({
        db,
        runDueSchedules: service.runDueSchedules,
        saveSchedule: service.saveSchedule,
        dateKey
    }));

    router.put(
        '/admin/levels/:level',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ params: levelParamsSchema, body: levelBodySchema }),
        route(async (req, res) => {
            const current = await repository.getLevel(req.params.level);
            await repository.updateLevel(req.params.level, {
                label: req.body.label,
                description: req.body.description || null,
                color: req.body.color || null
            });
            const updated = await repository.getLevel(req.params.level);
            await addAudit(db, req, {
                entityType: 'level_definition',
                entityId: req.params.level,
                action: 'updated',
                oldValue: current,
                newValue: updated
            });
            res.json(updated);
        })
    );

    router.get(
        '/admin/periods',
        authenticateToken,
        ensureAdminReport,
        route(async (req, res) => {
            if (canManage(req.user)) {
                await service.runDueSchedules(req).catch(error => {
                    console.error('Polyvalence schedule automation error:', error.message);
                });
            }
            const scopeDepartment = await loadReportScopeDepartment(db, req.user);
            if (!scopeDepartment) return res.json([]);
            const departmentId = scopeDepartment === 'all' ? null : scopeDepartment.id;
            const periods = await repository.listPeriods(departmentId);
            return res.json(periods.map(period => ({
                ...period,
                task_total: Number(period.task_total || 0),
                task_completed: Number(period.task_completed || 0)
            })));
        })
    );

    router.post(
        '/admin/periods',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ body: createPeriodBodySchema }),
        route(async (req, res) => {
            if (
                req.body.end_date < req.body.start_date
                || req.body.due_date < req.body.start_date
            ) {
                throw new AppError(
                    400,
                    'PERIOD_DATE_INVALID',
                    'Dönem tarihleri geçersiz.'
                );
            }
            const periodId = await repository.createPeriod({
                ...req.body,
                status: 'draft'
            });
            await addAudit(db, req, {
                entityType: 'period',
                entityId: periodId,
                action: 'created',
                newValue: req.body
            });
            res.json(await repository.getPeriod(periodId));
        })
    );

    router.get(
        '/admin/open-period-gaps',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        route(async (_req, res) => res.json(await service.listOpenPeriodGaps()))
    );

    router.post(
        '/admin/periods/:id/sync-open',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ params: idParamsSchema }),
        route(async (req, res) => (
            res.json(await service.syncOpenPeriodTargets(req, req.params.id))
        ))
    );

    router.post(
        '/admin/periods/:id/open',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ params: idParamsSchema }),
        route(async (req, res) => (
            res.json(await service.openDraftPeriod(req, req.params.id))
        ))
    );

    router.post(
        '/admin/periods/:id/close',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ params: idParamsSchema, body: closeBodySchema }),
        route(async (req, res) => (
            res.json(await service.closePeriod(
                req,
                req.params.id,
                req.body.override_reason
            ))
        ))
    );

    router.post(
        '/admin/periods/:id/cancel',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ params: idParamsSchema, body: reasonBodySchema }),
        route(async (req, res) => (
            res.json(await service.cancelPeriod(req, req.params.id, req.body.reason))
        ))
    );

    router.post(
        '/admin/tasks/:id/reopen',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ params: idParamsSchema, body: reasonBodySchema }),
        route(async (req, res) => (
            res.json(await service.reopenTask(req, req.params.id, req.body.reason))
        ))
    );

    return router;
};

module.exports = { createPeriodRouter };
