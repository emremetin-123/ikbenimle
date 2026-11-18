const { AppError } = require('../../core/http');

const parsePayload = (value) => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const futureSqlTimestamp = (seconds) => (
    new Date(Date.now() + seconds * 1000).toISOString().replace('T', ' ').replace('Z', '')
);

function createIntegrationDeliveryService(outboxRepository, integrationRepository) {
    return {
        async claim(integration, limit, requestId) {
            if (!integration.leaveRequestExportEnabled) {
                throw new AppError(409, 'LEAVE_REQUEST_EXPORT_DISABLED', 'İzin talebi aktarımı bu bağlantıda kapalı.');
            }
            const leaseSeconds = 120;
            const jobs = await outboxRepository.claim(
                integration.connectionId,
                integration.apiKeyId,
                limit,
                futureSqlTimestamp(leaseSeconds)
            );
            await integrationRepository.audit({
                connectionId: integration.connectionId,
                apiKeyId: integration.apiKeyId,
                direction: 'outbound',
                action: 'leave_requests.claim',
                status: 'success',
                requestId,
                details: { count: jobs.length }
            });
            return {
                items: jobs.map(job => ({
                    id: Number(job.id),
                    event_type: job.event_type,
                    aggregate_type: job.aggregate_type,
                    aggregate_id: job.aggregate_id,
                    idempotency_key: job.idempotency_key,
                    payload: parsePayload(job.payload_json),
                    attempt: Number(job.attempts),
                    created_at: job.created_at
                })),
                lease_seconds: leaseSeconds
            };
        },

        async acknowledge(integration, jobId, payload, requestId) {
            const job = await outboxRepository.getClaimedJob(
                jobId,
                integration.connectionId,
                integration.apiKeyId
            );
            if (!job || job.status !== 'leased') {
                throw new AppError(409, 'OUTBOX_LEASE_NOT_FOUND', 'Aktarım kaydı bu API anahtarına kiralanmamış veya süresi dolmuş.');
            }
            if (payload.status === 'succeeded') {
                await outboxRepository.complete(
                    jobId,
                    integration.connectionId,
                    integration.apiKeyId,
                    payload.external_reference
                );
            } else {
                const deadLetter = Number(job.attempts) >= Number(job.max_attempts);
                const retrySeconds = payload.retry_after_seconds
                    || Math.min(3600, 30 * (2 ** Math.max(0, Number(job.attempts) - 1)));
                await outboxRepository.fail(
                    jobId,
                    integration.connectionId,
                    integration.apiKeyId,
                    {
                        status: deadLetter ? 'dead_letter' : 'retry',
                        availableAt: futureSqlTimestamp(retrySeconds),
                        errorCode: payload.error_code,
                        errorMessage: payload.error_message
                    }
                );
            }
            await integrationRepository.audit({
                connectionId: integration.connectionId,
                apiKeyId: integration.apiKeyId,
                direction: 'outbound',
                action: 'leave_requests.ack',
                status: payload.status,
                entityType: 'integration_outbox',
                entityId: String(jobId),
                requestId,
                details: payload.status === 'failed'
                    ? { error_code: payload.error_code || 'REMOTE_DELIVERY_FAILED' }
                    : null
            });
            return { success: true };
        }
    };
}

module.exports = { createIntegrationDeliveryService };
