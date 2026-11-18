const { parsePagination, paginatedResponse } = require('../../core/pagination');

const createAdminIntegrationRepository = (db) => ({
    async listConnections() {
        return db.all(`
            SELECT c.*,
                (SELECT MAX(a.created_at) FROM integration_audit_events a
                 WHERE a.connection_id = c.id
                   AND a.action IN ('employees.upsert', 'leave_balances.upsert', 'leave_requests.ack', 'payrolls.upsert')
                   AND a.status IN ('success', 'succeeded')) AS transfer_success_at,
                (SELECT a.status FROM integration_audit_events a
                 WHERE a.connection_id = c.id
                   AND a.action IN ('employees.upsert', 'leave_balances.upsert', 'leave_requests.ack', 'payrolls.upsert')
                 ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS latest_transfer_status,
                (SELECT COUNT(*) FROM integration_api_keys k
                 WHERE k.connection_id = c.id
                   AND k.revoked_at IS NULL
                   AND (k.expires_at IS NULL OR k.expires_at > CURRENT_TIMESTAMP)) AS active_key_count,
                (SELECT COUNT(*) FROM integration_outbox o
                 WHERE o.connection_id = c.id
                   AND o.status IN ('pending', 'leased', 'retry')) AS pending_job_count
            FROM integration_connections c
            ORDER BY c.name, c.id
        `);
    },

    getConnection(id) {
        return db.get('SELECT * FROM integration_connections WHERE id = ?', [id]);
    },

    async createConnection(payload, actorId) {
        const result = await db.run(`
            INSERT INTO integration_connections (
                name, provider, is_enabled, employee_sync_enabled,
                leave_balance_sync_enabled, leave_request_export_enabled,
                leave_export_trigger, default_permissions_json, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            payload.name,
            payload.provider,
            payload.is_enabled ? 1 : 0,
            payload.employee_sync_enabled ? 1 : 0,
            payload.leave_balance_sync_enabled ? 1 : 0,
            payload.leave_request_export_enabled ? 1 : 0,
            payload.leave_export_trigger,
            JSON.stringify(payload.default_permissions || []),
            actorId,
            actorId
        ]);
        return this.getConnection(result.lastID);
    },

    async updateConnection(id, payload, actorId) {
        const result = await db.run(`
            UPDATE integration_connections
            SET name = ?, provider = ?, is_enabled = ?, employee_sync_enabled = ?,
                leave_balance_sync_enabled = ?, leave_request_export_enabled = ?,
                leave_export_trigger = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            payload.name,
            payload.provider,
            payload.is_enabled ? 1 : 0,
            payload.employee_sync_enabled ? 1 : 0,
            payload.leave_balance_sync_enabled ? 1 : 0,
            payload.leave_request_export_enabled ? 1 : 0,
            payload.leave_export_trigger,
            actorId,
            id
        ]);
        return result.changes ? this.getConnection(id) : null;
    },

    listApiKeys(connectionId) {
        return db.all(`
            SELECT id, connection_id, name, key_prefix, scopes_json,
                   ip_allowlist_json, expires_at, revoked_at, last_used_at, created_at
            FROM integration_api_keys
            WHERE connection_id = ?
            ORDER BY created_at DESC, id DESC
        `, [connectionId]);
    },

    async createApiKey(connectionId, payload) {
        const result = await db.run(`
            INSERT INTO integration_api_keys (
                connection_id, name, key_prefix, token_hash, scopes_json,
                ip_allowlist_json, expires_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            connectionId,
            payload.name,
            payload.keyPrefix,
            payload.tokenHash,
            JSON.stringify(payload.scopes),
            JSON.stringify(payload.ipAllowlist),
            payload.expiresAt || null,
            payload.actorId
        ]);
        return db.get(`
            SELECT id, connection_id, name, key_prefix, scopes_json,
                   ip_allowlist_json, expires_at, revoked_at, last_used_at, created_at
            FROM integration_api_keys WHERE id = ?
        `, [result.lastID]);
    },

    async revokeApiKey(connectionId, keyId) {
        const result = await db.run(`
            UPDATE integration_api_keys
            SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
            WHERE id = ? AND connection_id = ?
        `, [keyId, connectionId]);
        return result.changes > 0;
    },

    async listJobs(query) {
        const pagination = parsePagination(query);
        const clauses = [];
        const params = [];
        if (query.connection_id) {
            clauses.push('o.connection_id = ?');
            params.push(query.connection_id);
        }
        if (query.status) {
            clauses.push('o.status = ?');
            params.push(query.status);
        }
        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const total = await db.get(`
            SELECT COUNT(*) AS total FROM integration_outbox o ${whereSql}
        `, params);
        const items = await db.all(`
            SELECT o.id, o.connection_id, c.name AS connection_name,
                   o.event_type, o.aggregate_type, o.aggregate_id, o.status,
                   o.attempts, o.max_attempts, o.available_at, o.locked_until,
                   o.external_reference, o.last_error_code, o.last_error_message,
                   o.completed_at, o.created_at, o.updated_at
            FROM integration_outbox o
            JOIN integration_connections c ON c.id = o.connection_id
            ${whereSql}
            ORDER BY o.created_at DESC, o.id DESC
            LIMIT ? OFFSET ?
        `, [...params, pagination.pageSize, pagination.startRow - 1]);
        return paginatedResponse(items, total?.total, pagination.page, pagination.pageSize);
    },

    async listAuditEvents(query) {
        const pagination = parsePagination(query);
        const clauses = [];
        const params = [];
        if (query.connection_id) {
            clauses.push('a.connection_id = ?');
            params.push(query.connection_id);
        }
        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const total = await db.get(`
            SELECT COUNT(*) AS total FROM integration_audit_events a ${whereSql}
        `, params);
        const items = await db.all(`
            SELECT a.id, a.connection_id, c.name AS connection_name,
                   a.direction, a.action, a.status, a.entity_type, a.entity_id,
                   a.request_id, a.details_json, a.created_at
            FROM integration_audit_events a
            LEFT JOIN integration_connections c ON c.id = a.connection_id
            ${whereSql}
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT ? OFFSET ?
        `, [...params, pagination.pageSize, pagination.startRow - 1]);
        return paginatedResponse(items, total?.total, pagination.page, pagination.pageSize);
    }
});

module.exports = { createAdminIntegrationRepository };
