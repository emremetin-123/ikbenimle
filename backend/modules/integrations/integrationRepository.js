const createIntegrationRepository = (db) => ({
    findApiKeyByHash(tokenHash) {
        return db.get(`
            SELECT k.id AS api_key_id, k.connection_id, k.name AS api_key_name,
                   k.scopes_json, k.ip_allowlist_json, k.expires_at,
                   c.name AS connection_name, c.provider, c.is_enabled,
                   c.employee_sync_enabled, c.leave_balance_sync_enabled,
                   c.leave_request_export_enabled
            FROM integration_api_keys k
            JOIN integration_connections c ON c.id = k.connection_id
            WHERE k.token_hash = ?
              AND k.revoked_at IS NULL
              AND (k.expires_at IS NULL OR k.expires_at > CURRENT_TIMESTAMP)
        `, [tokenHash]);
    },

    async markApiKeyUsed(apiKeyId, connectionId) {
        await db.transaction(async tx => {
            await tx.run(
                'UPDATE integration_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
                [apiKeyId]
            );
            await tx.run(`
                UPDATE integration_connections
                SET last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [connectionId]);
        });
    },

    findIdempotencyRecord(connectionId, method, path, idempotencyKey) {
        return db.get(`
            SELECT response_status, response_json
            FROM integration_idempotency_records
            WHERE connection_id = ? AND request_method = ?
              AND request_path = ? AND idempotency_key = ?
              AND expires_at > CURRENT_TIMESTAMP
        `, [connectionId, method, path, idempotencyKey]);
    },

    createIdempotencyRecord(tx, record) {
        return tx.run(`
            INSERT INTO integration_idempotency_records (
                connection_id, api_key_id, idempotency_key,
                request_method, request_path, response_status,
                response_json, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            record.connectionId,
            record.apiKeyId,
            record.idempotencyKey,
            record.method,
            record.path,
            record.responseStatus,
            JSON.stringify(record.response),
            record.expiresAt
        ]);
    },

    findUserByEmployeeId(tx, employeeId) {
        return tx.get(`
            SELECT id, employee_id, name, role, status, password_hash, permissions
            FROM users WHERE employee_id = ?
        `, [employeeId]);
    },

    findEmployeeMapping(tx, connectionId, externalEmployeeId) {
        return tx.get(`
            SELECT m.*, u.employee_id
            FROM integration_employee_mappings m
            JOIN users u ON u.id = m.user_id
            WHERE m.connection_id = ? AND m.external_employee_id = ?
        `, [connectionId, externalEmployeeId]);
    },

    createEmployee(tx, employee, defaultPermissions) {
        return tx.run(`
            INSERT INTO users (
                employee_id, name, department, position, manager_id,
                status, password_hash, role, permissions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            employee.employee_id,
            employee.name,
            employee.department,
            employee.position,
            null,
            employee.status,
            null,
            'employee',
            JSON.stringify(defaultPermissions)
        ]);
    },

    updateEmployee(tx, userId, employee) {
        return tx.run(`
            UPDATE users
            SET employee_id = ?, name = ?, department = ?, position = ?, status = ?
            WHERE id = ?
        `, [
            employee.employee_id,
            employee.name,
            employee.department,
            employee.position,
            employee.status,
            userId
        ]);
    },

    async upsertPersonalInfo(tx, userId, employee) {
        const update = await tx.run(`
            UPDATE personal_info
            SET email = COALESCE(?, email), phone = COALESCE(?, phone),
                birth_date = COALESCE(?, birth_date)
            WHERE user_id = ?
        `, [employee.email ?? null, employee.phone ?? null, employee.birth_date ?? null, userId]);
        if (!update.changes) {
            await tx.run(`
                INSERT INTO personal_info (user_id, email, phone, birth_date)
                VALUES (?, ?, ?, ?)
            `, [userId, employee.email ?? null, employee.phone ?? null, employee.birth_date ?? null]);
        }
    },

    async upsertEmployeeMapping(tx, connectionId, externalEmployeeId, userId, sourceUpdatedAt) {
        const update = await tx.run(`
            UPDATE integration_employee_mappings
            SET user_id = ?, source_updated_at = ?, last_synced_at = CURRENT_TIMESTAMP
            WHERE connection_id = ? AND external_employee_id = ?
        `, [userId, sourceUpdatedAt || null, connectionId, externalEmployeeId]);
        if (!update.changes) {
            await tx.run(`
                INSERT INTO integration_employee_mappings (
                    connection_id, external_employee_id, user_id, source_updated_at
                ) VALUES (?, ?, ?, ?)
            `, [connectionId, externalEmployeeId, userId, sourceUpdatedAt || null]);
        }
    },

    updateEmployeeManager(tx, userId, managerId) {
        return tx.run('UPDATE users SET manager_id = ? WHERE id = ?', [managerId, userId]);
    },

    async upsertLeaveBalance(tx, connectionId, mapping, balance) {
        const update = await tx.run(`
            UPDATE integration_leave_balances
            SET external_employee_id = ?, balance_days = ?, as_of_date = ?,
                source_updated_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE connection_id = ? AND user_id = ?
        `, [
            balance.external_employee_id,
            balance.balance_days,
            balance.as_of_date,
            balance.source_updated_at || null,
            connectionId,
            mapping.user_id
        ]);
        if (!update.changes) {
            await tx.run(`
                INSERT INTO integration_leave_balances (
                    connection_id, user_id, external_employee_id,
                    balance_days, as_of_date, source_updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                connectionId,
                mapping.user_id,
                balance.external_employee_id,
                balance.balance_days,
                balance.as_of_date,
                balance.source_updated_at || null
            ]);
        }
    },

    getUserLeaveBalance(userId) {
        return db.get(`
            SELECT b.balance_days, b.as_of_date, b.source_updated_at, b.updated_at,
                   c.name AS source_name
            FROM integration_leave_balances b
            JOIN integration_connections c ON c.id = b.connection_id
            WHERE b.user_id = ? AND c.is_enabled = 1
            ORDER BY b.updated_at DESC, b.id DESC
            LIMIT 1
        `, [userId]);
    },

    audit(event, executor = db) {
        return executor.run(`
            INSERT INTO integration_audit_events (
                connection_id, api_key_id, actor_user_id, direction,
                action, status, entity_type, entity_id, request_id, details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            event.connectionId || null,
            event.apiKeyId || null,
            event.actorUserId || null,
            event.direction,
            event.action,
            event.status,
            event.entityType || null,
            event.entityId || null,
            event.requestId || null,
            event.details ? JSON.stringify(event.details) : null
        ]);
    },

    markConnectionSuccess(tx, connectionId) {
        return tx.run(`
            UPDATE integration_connections
            SET last_success_at = CURRENT_TIMESTAMP, last_error_code = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [connectionId]);
    }
});

module.exports = { createIntegrationRepository };
