const crypto = require('node:crypto');
const { AppError } = require('../../core/http');

const DEFAULT_EMPLOYEE_PERMISSIONS = [
    'view_education',
    'view_announcements',
    'view_documents',
    'view_feedback',
    'view_careers',
    'view_knowledge_portal',
    'view_news',
    'view_surveys',
    'view_service_routes'
];

const parseJsonArray = (value) => {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const mapConnection = (row) => ({
    ...row,
    last_success_at: row.transfer_success_at || row.last_success_at || null,
    last_error_code: row.latest_transfer_status === 'failed' ? 'TRANSFER_FAILED' : row.latest_transfer_status ? null : row.last_error_code || null,
    is_enabled: Boolean(row.is_enabled),
    employee_sync_enabled: Boolean(row.employee_sync_enabled),
    leave_balance_sync_enabled: Boolean(row.leave_balance_sync_enabled),
    leave_request_export_enabled: Boolean(row.leave_request_export_enabled),
    active_key_count: Number(row.active_key_count || 0),
    pending_job_count: Number(row.pending_job_count || 0)
});

const mapApiKey = (row) => ({
    ...row,
    scopes: parseJsonArray(row.scopes_json),
    ip_allowlist: parseJsonArray(row.ip_allowlist_json),
    scopes_json: undefined,
    ip_allowlist_json: undefined
});

const mapAudit = (row) => {
    let details = null;
    try {
        details = row.details_json ? JSON.parse(row.details_json) : null;
    } catch {
        details = null;
    }
    return { ...row, details, details_json: undefined };
};

function createAdminIntegrationService(repository, integrationRepository) {
    return {
        async listConnections() {
            const rows = await repository.listConnections();
            return rows.map(mapConnection);
        },

        async createConnection(payload, actor) {
            const connection = await repository.createConnection({
                ...payload,
                default_permissions: DEFAULT_EMPLOYEE_PERMISSIONS
            }, actor.id);
            await integrationRepository.audit({
                connectionId: connection.id,
                actorUserId: actor.id,
                direction: 'admin',
                action: 'connection.created',
                status: 'success',
                entityType: 'integration_connection',
                entityId: String(connection.id)
            });
            return mapConnection(connection);
        },

        async updateConnection(id, payload, actor) {
            const connection = await repository.updateConnection(id, payload, actor.id);
            if (!connection) {
                throw new AppError(404, 'INTEGRATION_CONNECTION_NOT_FOUND', 'Entegrasyon bağlantısı bulunamadı.');
            }
            await integrationRepository.audit({
                connectionId: id,
                actorUserId: actor.id,
                direction: 'admin',
                action: 'connection.updated',
                status: 'success',
                entityType: 'integration_connection',
                entityId: String(id)
            });
            return mapConnection(connection);
        },

        async listApiKeys(connectionId) {
            const connection = await repository.getConnection(connectionId);
            if (!connection) {
                throw new AppError(404, 'INTEGRATION_CONNECTION_NOT_FOUND', 'Entegrasyon bağlantısı bulunamadı.');
            }
            return (await repository.listApiKeys(connectionId)).map(mapApiKey);
        },

        async createApiKey(connectionId, payload, actor) {
            const connection = await repository.getConnection(connectionId);
            if (!connection) {
                throw new AppError(404, 'INTEGRATION_CONNECTION_NOT_FOUND', 'Entegrasyon bağlantısı bulunamadı.');
            }
            const token = `ikp_${crypto.randomBytes(32).toString('base64url')}`;
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const key = await repository.createApiKey(connectionId, {
                name: payload.name,
                keyPrefix: token.slice(0, 12),
                tokenHash,
                scopes: [...new Set(payload.scopes)],
                ipAllowlist: [...new Set(payload.ip_allowlist || [])],
                expiresAt: payload.expires_at || null,
                actorId: actor.id
            });
            await integrationRepository.audit({
                connectionId,
                actorUserId: actor.id,
                direction: 'admin',
                action: 'api_key.created',
                status: 'success',
                entityType: 'integration_api_key',
                entityId: String(key.id),
                details: { scopes: payload.scopes }
            });
            return { ...mapApiKey(key), token };
        },

        async revokeApiKey(connectionId, keyId, actor) {
            const revoked = await repository.revokeApiKey(connectionId, keyId);
            if (!revoked) {
                throw new AppError(404, 'INTEGRATION_API_KEY_NOT_FOUND', 'API anahtarı bulunamadı.');
            }
            await integrationRepository.audit({
                connectionId,
                actorUserId: actor.id,
                direction: 'admin',
                action: 'api_key.revoked',
                status: 'success',
                entityType: 'integration_api_key',
                entityId: String(keyId)
            });
            return { success: true };
        },

        listJobs(query) {
            return repository.listJobs(query);
        },

        async listAuditEvents(query) {
            const result = await repository.listAuditEvents(query);
            return { ...result, items: result.items.map(mapAudit) };
        }
    };
}

module.exports = {
    DEFAULT_EMPLOYEE_PERMISSIONS,
    createAdminIntegrationService
};
