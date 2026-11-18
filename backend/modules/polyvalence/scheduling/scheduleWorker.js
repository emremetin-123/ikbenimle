const crypto = require('node:crypto');
const { createPolyvalenceContextRepository } = require('../polyvalenceContextRepository');
const {
    addDays,
    addMonths,
    buildPeriodName,
    createPolyvalenceContextService,
    dateKey,
    findDepartmentForUser,
    findRoleForUser,
    toBool
} = require('../polyvalenceContextService');
const { createMembershipService } = require('../memberships/membershipService');
const { createPeriodRepository } = require('../periods/periodRepository');
const { createPeriodService } = require('../periods/periodService');

const createScheduleWorker = (db) => {
    const contextRepository = createPolyvalenceContextRepository(db);
    const contextService = createPolyvalenceContextService(contextRepository);
    const membershipService = createMembershipService({
        db,
        findDepartmentForUser,
        findRoleForUser
    });
    const syncMemberships = async (options) => {
        await contextService.ensureUserPoolDefinitions();
        return membershipService.syncMemberships(options);
    };
    const addAudit = (activeDb, req, data) => (
        createPolyvalenceContextRepository(activeDb).insertAudit({
            ...data,
            oldValue: data.oldValue ?? null,
            newValue: data.newValue ?? null,
            actorUserId: req.user?.id || null,
            ipAddress: req.ip || null,
            userAgent: req.headers?.['user-agent'] || 'background-worker'
        })
    );
    const service = createPeriodService({
        db,
        repository: createPeriodRepository(db),
        addAudit,
        toBool,
        dateKey,
        addMonths,
        addDays,
        buildPeriodName,
        syncMemberships
    });
    const systemRequest = {
        user: { id: null, role: 'system', permissions: [] },
        ip: null,
        headers: { 'user-agent': 'background-worker' }
    };

    return () => service.runDueSchedules(systemRequest);
};

const acquireLease = async (db, ownerId) => {
    const lockDate = new Date(Date.now() + 55 * 1000);
    const lockUntil = process.env.DB_TYPE === 'postgres'
        ? lockDate
        : lockDate.toISOString().replace('T', ' ').replace('Z', '');
    const updated = await db.run(
        `UPDATE scheduler_locks
         SET owner_id = ?, lock_until = ?, updated_at = CURRENT_TIMESTAMP
         WHERE lock_name = ? AND (lock_until <= CURRENT_TIMESTAMP OR owner_id = ?)`,
        [ownerId, lockUntil, 'polyvalence_period_scheduler', ownerId]
    );
    if (updated.changes > 0) return true;
    try {
        await db.run(
            'INSERT INTO scheduler_locks (lock_name, owner_id, lock_until) VALUES (?, ?, ?)',
            ['polyvalence_period_scheduler', ownerId, lockUntil]
        );
        return true;
    } catch {
        return false;
    }
};

const startPolyvalenceScheduleWorker = (db) => {
    const ownerId = crypto.randomUUID();
    const runDueSchedules = createScheduleWorker(db);
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            if (!(await acquireLease(db, ownerId))) return;
            const result = await runDueSchedules();
            if (result.errors.length) {
                console.error('Polyvalence schedule errors:', result.errors);
            }
        } catch (error) {
            console.error('Polyvalence schedule worker error:', error.message);
        } finally {
            running = false;
        }
    };
    void tick();
    const timer = setInterval(tick, 60 * 1000);
    return () => clearInterval(timer);
};

module.exports = {
    createScheduleWorker,
    startPolyvalenceScheduleWorker
};
