const { Router } = require('express');
const { z } = require('zod');
const { AppError } = require('../../../core/http');
const { validate } = require('../../../core/validation');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const pushService = require('../../../services/pushNotificationService');

const MANAGE_PERMISSION = 'manage_polyvalence';
const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const scheduleBodySchema = z.object({
    department_id: z.coerce.number().int().positive(),
    frequency_months: z.coerce.number().int().min(1).max(120).optional().default(12),
    next_start_date: z.union([dateSchema, z.literal(''), z.null()]).optional(),
    duration_days: z.coerce.number().int().min(1).max(366).optional().default(30),
    reminder_days: z.union([z.string().trim().max(100), z.array(z.coerce.number().int().min(0).max(366)).max(50)]).optional(),
    is_active: z.boolean().optional().default(true)
}).strict();
const runBodySchema = z.object({
    date: z.union([dateSchema, z.literal('')]).optional()
}).strict();

const route = (handler) => async (req, res, next) => {
    try {
        return await handler(req, res);
    } catch (error) {
        return next(error);
    }
};

const normalizeReminderDays = (value) => {
    const source = Array.isArray(value) ? value : String(value || '7,3,1').split(',');
    const reminders = source
        .map(Number)
        .filter(item => Number.isInteger(item) && item >= 0 && item <= 366);
    return [...new Set(reminders)].join(',') || '7,3,1';
};

const createScheduleRouter = ({ db, runDueSchedules, saveSchedule, dateKey }) => {
    const router = Router();

    router.put(
        '/admin/schedules',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ body: scheduleBodySchema }),
        route(async (req, res) => {
            res.json(await saveSchedule(req, {
                departmentId: req.body.department_id,
                frequencyMonths: req.body.frequency_months,
                nextStartDate: dateKey(req.body.next_start_date) || null,
                durationDays: req.body.duration_days,
                reminderDays: normalizeReminderDays(req.body.reminder_days),
                isActive: req.body.is_active
            }));
        })
    );

    router.post(
        '/admin/schedules/run',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ body: runBodySchema }),
        route(async (req, res) => {
            const summary = await runDueSchedules(req, req.body.date);
            res.json({ success: true, ...summary });
        })
    );

    router.post(
        '/internal/cron/run-polyvalence',
        validate({ body: runBodySchema }),
        route(async (req, res) => {
            const secret = process.env.POLYVALENCE_CRON_SECRET;
            if (!secret || req.headers['x-cron-secret'] !== secret) {
                throw new AppError(404, 'NOT_FOUND', 'Not found');
            }
            const systemReq = {
                user: { id: null, role: 'system', permissions: [] },
                ip: req.ip,
                headers: req.headers
            };
            const schedules = await runDueSchedules(systemReq, req.body.date);
            const reminders = await pushService.sendDuePolyvalenceReminders(db);
            res.json({ success: true, schedules, reminders });
        })
    );

    return router;
};

module.exports = { createScheduleRouter };
