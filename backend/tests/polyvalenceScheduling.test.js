const test = require('node:test');
const assert = require('node:assert/strict');

const { createScheduleService, scheduleDateKey } = require('../modules/polyvalence/scheduling/scheduleService');
const {
    addDays,
    addMonths,
    buildPeriodName,
    dateKey
} = require('../modules/polyvalence/polyvalenceContextService');

test('takvim gunu Turkiye saatine gore hesaplanir', () => {
    assert.equal(scheduleDateKey(new Date('2026-09-17T22:30:00Z')), '2026-09-18');
});

test('zamanlayicinin onceki denemeden kalan taslagi yeniden acar', async () => {
    const start = '2026-09-01';
    const updates = [];
    const opened = [];
    const repository = {
        listDueOpenPeriods: async () => [],
        listActiveSchedules: async () => [{
            id: 4,
            department_id: 9,
            department_name: 'Üretim',
            frequency_months: 6,
            duration_days: 30,
            next_start_date: start
        }],
        findActivePeriod: async () => ({
            id: 12,
            status: 'draft',
            name: buildPeriodName(start, 6),
            start_date: start,
            end_date: addDays(start, 29),
            due_date: addDays(start, 29)
        }),
        updateScheduleNextStart: async (id, nextStart) => updates.push({ id, nextStart })
    };
    const service = createScheduleService({
        db: {},
        repository,
        addAudit: async () => undefined,
        dateKey,
        addMonths,
        addDays,
        buildPeriodName,
        openDraftPeriod: async (_req, id) => opened.push(id)
    });

    const result = await service.runDueSchedules({ user: { id: null } }, '2026-09-09');

    assert.equal(result.opened, 1);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(opened, [12]);
    assert.deepEqual(updates, [{ id: 4, nextStart: '2027-03-01' }]);
});

test('acilamayan donemin nedeni doner ve takvim tarihi ilerletilmez', async () => {
    const updates = [];
    const repository = {
        listDueOpenPeriods: async () => [],
        listActiveSchedules: async () => [{
            id: 4, department_id: 9, department_name: 'Uretim',
            frequency_months: 6, duration_days: 30, next_start_date: '2026-09-18'
        }],
        findActivePeriod: async () => null,
        createPeriod: async () => 12,
        updateScheduleNextStart: async (...args) => updates.push(args)
    };
    const service = createScheduleService({
        db: {}, repository, addAudit: async () => undefined,
        dateKey, addMonths, addDays, buildPeriodName,
        openDraftPeriod: async () => {
            throw new Error('1 çalışanın değerlendirecek amiri eksik.');
        }
    });

    const result = await service.runDueSchedules({ user: { id: null } }, '2026-09-18');
    assert.equal(result.opened, 0);
    assert.deepEqual(result.errors, [{
        schedule_id: 4,
        department: 'Uretim',
        message: '1 çalışanın değerlendirecek amiri eksik.'
    }]);
    assert.deepEqual(updates, []);
});

test('elle kapatma takvimdeki tarihi korur ve otomatik acilabilir taslak uretir', async () => {
    const { createPeriodService } = require('../modules/polyvalence/periods/periodService');
    let active = { id: 5, department_id: 9, status: 'open', start_date: '2026-10-23' };
    const schedule = { id: 2, department_id: 9, department_name: 'Test Bölüm', frequency_months: 1, duration_days: 30, next_start_date: '2026-11-01' };
    const repository = {
        getPeriod: async () => active,
        getTaskCounts: async () => ({ total: 1, completed: 1 }),
        transaction: async fn => fn({}), closePeriod: async () => { active = null; },
        getActiveSchedule: async () => schedule, findActivePeriod: async () => active,
        createPeriod: async value => { active = { ...value, id: 6 }; return 6; },
        updateScheduleNextStart: async (_id, date) => { schedule.next_start_date = date; },
        listDueOpenPeriods: async () => [], listActiveSchedules: async () => [schedule],
    };
    const dependencies = { db: {}, repository, addAudit: async () => {}, dateKey, addDays, addMonths, buildPeriodName };
    const service = createPeriodService(dependencies);
    await service.closePeriod({ user: { id: 1 } }, 5);
    assert.equal(active.start_date, '2026-11-01');
    assert.equal(active.end_date, '2026-11-30');
    assert.equal(active.name, buildPeriodName('2026-11-01', 1));
    let opened = 0;
    const scheduler = createScheduleService({ ...dependencies, openDraftPeriod: async () => { opened++; active.status = 'open'; } });
    const result = await scheduler.runDueSchedules({ user: { id: 1 } }, '2026-11-01');
    assert.equal(result.opened, 1);
    assert.equal(opened, 1);
    assert.deepEqual(result.errors, []);
    assert.equal(schedule.next_start_date, '2026-12-01');
    const blocked = await scheduler.runDueSchedules({ user: { id: 1 } }, '2026-12-01');
    assert.equal(blocked.opened, 0);
    assert.equal(blocked.blocked[0].period_id, 6);
    assert.match(blocked.blocked[0].message, /hâlâ açık/);
    assert.equal(opened, 1);
});
