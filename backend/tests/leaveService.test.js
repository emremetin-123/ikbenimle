const test = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateDuration,
    createLeaveRequestService
} = require('../modules/leave/leaveService');

test('izin süresi mevcut saat ve gün kurallarını korur', () => {
    assert.deepEqual(
        calculateDuration(
            new Date('2026-10-01T08:00:00.000Z'),
            new Date('2026-10-01T12:30:00.000Z'),
            'Gün'
        ),
        { duration_type: 'Saat', duration_value: 4.5 }
    );
    assert.deepEqual(
        calculateDuration(
            new Date('2026-10-01T08:00:00.000Z'),
            new Date('2026-10-02T17:00:00.000Z'),
            'Gün'
        ),
        { duration_type: 'Gün', duration_value: 2 }
    );
});

test('izin oluşturma ve ERP outbox kaydı aynı transaction bağlamını kullanır', async () => {
    const transactionContext = { name: 'leave-transaction' };
    let created;
    let enqueued;
    const transactionRepository = {
        async create(data) {
            created = data;
            return { lastID: 42, changes: 1 };
        }
    };
    const service = createLeaveRequestService({}, {
        transaction: work => work(transactionRepository, transactionContext),
        enqueue: async (...args) => { enqueued = args; }
    });

    const result = await service.createRequest(
        { id: 7, name: 'Test Çalışanı', employee_id: 'T-7' },
        {
            leave_type: 'YILLIK İZİN',
            start_datetime: '2026-10-01T08:00:00.000Z',
            end_datetime: '2026-10-02T17:00:00.000Z',
            return_datetime: '2026-10-03T08:00:00.000Z',
            duration_type: 'Gün',
            description: 'Planlı izin'
        }
    );

    assert.equal(created.userId, 7);
    assert.equal(created.durationValue, 2);
    assert.equal(enqueued[0], transactionContext);
    assert.equal(enqueued[1], 'created');
    assert.equal(enqueued[2].id, 42);
    assert.deepEqual(result, {
        id: 42,
        duration_type: 'Gün',
        duration_value: 2,
        status: 'İletildi'
    });
});

test('onaylanan izin aynı transaction içinde ERP outbox kaydı üretir', async () => {
    const transactionContext = { name: 'status-transaction' };
    let enqueued;
    const transactionRepository = {
        updateStatus: async () => ({ changes: 1 }),
        findForIntegration: async () => ({
            id: 12,
            user_id: 8,
            employee_id: 'T-8',
            user_name: 'Onay Testi'
        })
    };
    const service = createLeaveRequestService({}, {
        transaction: work => work(transactionRepository, transactionContext),
        enqueue: async (...args) => { enqueued = args; }
    });

    assert.deepEqual(await service.updateStatus(12, 'Onaylandı', 1), {
        success: true,
        status: 'Onaylandı'
    });
    assert.equal(enqueued[0], transactionContext);
    assert.equal(enqueued[1], 'approved');
    assert.equal(enqueued[2].id, 12);
    assert.deepEqual(enqueued[3], {
        id: 8,
        employee_id: 'T-8',
        name: 'Onay Testi'
    });
});
