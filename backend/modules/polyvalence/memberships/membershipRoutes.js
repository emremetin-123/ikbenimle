const { Router } = require('express');
const { z } = require('zod');
const { AppError } = require('../../../core/http');
const { validate } = require('../../../core/validation');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');

const MANAGE_PERMISSION = 'manage_polyvalence';
const positiveId = z.coerce.number().int().positive();
const optionalId = z.preprocess(
    value => value === '' || value === undefined ? null : value,
    z.union([z.null(), positiveId])
);
const targetBodySchema = z.object({
    skill_id: positiveId,
    role_id: positiveId,
    target_level: z.coerce.number().int().min(0).max(3),
    criticality: z.enum(['normal', 'critical']).default('normal'),
    min_qualified_count: z.coerce.number().int().min(1).max(10000).default(1)
}).strict();
const membershipBodySchema = z.object({
    user_id: positiveId,
    department_id: optionalId,
    role_id: optionalId,
    evaluator_user_id: optionalId,
    is_active: z.boolean().optional().default(true)
}).strict();
const autoSyncBodySchema = z.object({
    overwrite: z.boolean().optional().default(false)
}).strict();
const membershipParamsSchema = z.object({ id: positiveId }).strict();

const route = (handler) => async (req, res, next) => {
    try {
        return await handler(req, res);
    } catch (error) {
        if (/unique|duplicate|constraint/i.test(String(error?.message || ''))) {
            return next(new AppError(409, 'RESOURCE_CONFLICT', 'Bu eşleşme için zaten bir kayıt mevcut.'));
        }
        return next(error);
    }
};

const createMembershipRouter = ({ db, addAudit, resolveMembershipDefaults, membershipService }) => {
    const router = Router();
    const secured = [authenticateToken, requirePermission(MANAGE_PERMISSION)];

    router.put('/admin/targets', ...secured, validate({ body: targetBodySchema }), route(async (req, res) => {
        const { current, updated } = await membershipService.saveTarget(req.body);
        await addAudit(db, req, {
            entityType: 'skill_target',
            entityId: updated.id,
            action: current ? 'updated' : 'created',
            oldValue: current,
            newValue: updated
        });
        return res.json(updated);
    }));

    router.put('/admin/memberships', ...secured, validate({ body: membershipBodySchema }), route(async (req, res) => {
        const { current, updated } = await membershipService.saveMembership(
            req.body,
            resolveMembershipDefaults
        );
        await addAudit(db, req, {
            entityType: 'membership',
            entityId: updated.id,
            action: current ? 'updated' : 'created',
            oldValue: current,
            newValue: updated
        });
        return res.json(updated);
    }));

    router.post('/admin/memberships/auto-sync', ...secured,
        validate({ body: autoSyncBodySchema }), route(async (req, res) => {
            const summary = await membershipService.syncMemberships({ overwrite: req.body.overwrite });
            await addAudit(db, req, {
                entityType: 'membership',
                entityId: null,
                action: 'auto_synced',
                newValue: { overwrite: req.body.overwrite, ...summary }
            });
            return res.json({ success: true, ...summary });
        }));

    router.delete('/admin/memberships/:id/override', ...secured,
        validate({ params: membershipParamsSchema }), route(async (req, res) => {
            const { current, updated } = await membershipService.resetToDefaults(
                req.params.id,
                resolveMembershipDefaults
            );
            await addAudit(db, req, {
                entityType: 'membership',
                entityId: updated.id,
                action: 'reset_to_default',
                oldValue: current,
                newValue: updated
            });
            return res.json(updated);
        }));

    return router;
};

module.exports = { createMembershipRouter };
