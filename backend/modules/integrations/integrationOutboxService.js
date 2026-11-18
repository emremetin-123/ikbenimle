const { createIntegrationOutboxRepository } = require('./integrationOutboxRepository');

const isUniqueViolation = (error) => (
    error?.code === '23505'
    || error?.code === 'SQLITE_CONSTRAINT'
    || String(error?.message || '').includes('UNIQUE constraint failed')
);

const buildLeavePayload = (request, user) => ({
    contract_version: 1,
    leave_request_id: Number(request.id),
    employee_id: user.employee_id,
    employee_name: user.name,
    leave_type: request.leave_type,
    start_datetime: request.start_datetime,
    end_datetime: request.end_datetime,
    return_datetime: request.return_datetime,
    duration_type: request.duration_type,
    duration_value: Number(request.duration_value),
    description: request.description || null,
    status: request.status,
    created_at: request.created_at || new Date().toISOString()
});

const enqueueLeaveRequest = async (tx, trigger, request, user) => {
    const repository = createIntegrationOutboxRepository(tx);
    const connections = await repository.listExportConnections(tx, trigger);
    for (const connection of connections) {
        const eventType = trigger === 'approved'
            ? 'leave_request.approved'
            : 'leave_request.created';
        try {
            await repository.enqueue(tx, {
                connectionId: connection.id,
                eventType,
                aggregateType: 'leave_request',
                aggregateId: request.id,
                idempotencyKey: `${eventType}:${connection.id}:${request.id}`,
                payload: buildLeavePayload(request, user)
            });
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
        }
    }
};

module.exports = { enqueueLeaveRequest };
