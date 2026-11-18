const crypto = require('node:crypto');
const { AppError } = require('../../core/http');
const { createIntegrationRepository } = require('./integrationRepository');

const parseJsonArray = (value) => {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const normalizeIp = (value = '') => String(value).replace(/^::ffff:/, '');

const createIntegrationAuth = (db) => {
    const repository = createIntegrationRepository(db);
    return async (req, _res, next) => {
        try {
            const authorization = req.get('authorization') || '';
            const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
            if (!match) {
                throw new AppError(401, 'INTEGRATION_AUTHENTICATION_FAILED', 'Entegrasyon kimliği doğrulanamadı.');
            }
            const tokenHash = crypto.createHash('sha256').update(match[1]).digest('hex');
            const key = await repository.findApiKeyByHash(tokenHash);
            if (!key || !key.is_enabled) {
                throw new AppError(401, 'INTEGRATION_AUTHENTICATION_FAILED', 'Entegrasyon kimliği doğrulanamadı.');
            }
            const allowedIps = parseJsonArray(key.ip_allowlist_json).map(normalizeIp);
            const requestIp = normalizeIp(req.ip);
            if (allowedIps.length && !allowedIps.includes(requestIp)) {
                throw new AppError(403, 'INTEGRATION_IP_DENIED', 'Bu IP adresinden entegrasyon erişimine izin verilmiyor.');
            }
            req.integration = {
                connectionId: Number(key.connection_id),
                connectionName: key.connection_name,
                provider: key.provider,
                apiKeyId: Number(key.api_key_id),
                apiKeyName: key.api_key_name,
                scopes: parseJsonArray(key.scopes_json),
                employeeSyncEnabled: Boolean(key.employee_sync_enabled),
                leaveBalanceSyncEnabled: Boolean(key.leave_balance_sync_enabled),
                leaveRequestExportEnabled: Boolean(key.leave_request_export_enabled)
            };
            await repository.markApiKeyUsed(key.api_key_id, key.connection_id);
            next();
        } catch (error) {
            next(error);
        }
    };
};

const requireIntegrationScope = (scope) => (req, _res, next) => {
    if (req.integration?.scopes?.includes(scope)) return next();
    return next(new AppError(403, 'INTEGRATION_SCOPE_REQUIRED', 'API anahtarının bu işlem için kapsamı yok.'));
};

module.exports = { createIntegrationAuth, requireIntegrationScope };
