const { Router } = require('express');
const { z } = require('zod');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate } = require('../core/validation');
const {
    createPolyvalenceRepository
} = require('../modules/polyvalence/polyvalenceRepository');
const {
    createPolyvalenceContextRepository
} = require('../modules/polyvalence/polyvalenceContextRepository');
const {
    MANAGE_PERMISSION,
    addDays,
    addMonths,
    buildPeriodName,
    canManage,
    canReport,
    createPolyvalenceContextService,
    csvCell,
    dateKey,
    findDepartmentForUser,
    findRoleForUser,
    toBool,
    toId
} = require('../modules/polyvalence/polyvalenceContextService');
const {
    createPolyvalenceController
} = require('../modules/polyvalence/polyvalenceController');
const { createTaskRouter } = require('../modules/polyvalence/tasks/taskRoutes');
const { createCatalogRouter } = require('../modules/polyvalence/catalog/catalogRoutes');
const {
    createMembershipRouter
} = require('../modules/polyvalence/memberships/membershipRoutes');
const {
    createMembershipService
} = require('../modules/polyvalence/memberships/membershipService');
const {
    createMembershipRepository
} = require('../modules/polyvalence/memberships/membershipRepository');
const { createReportRouter } = require('../modules/polyvalence/reports/reportRoutes');
const { createPeriodRouter } = require('../modules/polyvalence/periods/periodRoutes');

const ensureAdminReport = (req, res, next) => {
    if (canReport(req.user)) return next();
    return res.status(403).json({ error: 'Polivalans raporu yetkisi gerekli' });
};
const setupQuerySchema = z.object({
    resource: z.enum(['users', 'memberships']).optional(),
    includeLarge: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional()
}).strict();

module.exports = db => {
    const router = Router();
    const repository = createPolyvalenceRepository(db);
    const contextService = createPolyvalenceContextService(
        createPolyvalenceContextRepository(db)
    );
    const membershipService = createMembershipService({
        repository: createMembershipRepository(db),
        findDepartmentForUser,
        findRoleForUser
    });
    const syncMemberships = async (options) => {
        await contextService.ensureUserPoolDefinitions();
        return membershipService.syncMemberships(options);
    };
    const controller = createPolyvalenceController(contextService, { syncMemberships });
    const addAudit = (activeDb, req, data) => (
        createPolyvalenceContextRepository(activeDb).insertAudit({
            ...data,
            oldValue: data.oldValue ?? null,
            newValue: data.newValue ?? null,
            actorUserId: req.user?.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        })
    );
    const loadReportScopeDepartment = (_db, user) => (
        contextService.loadReportScopeDepartment(user)
    );
    const assertReportPeriodAccess = (_db, req, periodId) => (
        contextService.assertReportPeriodAccess(req.user, periodId)
    );
    const resolveMembershipDefaults = (_db, userId) => (
        contextService.resolveMembershipDefaults(userId)
    );

    router.use(createTaskRouter({ db, repository }));
    router.use(createCatalogRouter({ db, addAudit }));
    router.use(createMembershipRouter({
        db,
        addAudit,
        resolveMembershipDefaults,
        membershipService
    }));
    router.get(
        '/admin/setup',
        authenticateToken,
        requirePermission(MANAGE_PERMISSION),
        validate({ query: setupQuerySchema }),
        controller.setup
    );
    router.use(createPeriodRouter({
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
    }));
    router.use(createReportRouter({
        db,
        repository,
        ensureAdminReport,
        loadReportScopeDepartment,
        assertReportPeriodAccess,
        addAudit,
        toId,
        toBool,
        dateKey,
        csvCell
    }));
    return router;
};
