const createIntegrationOutboxRepository = (db) => ({
    listExportConnections(tx, trigger) {
        return tx.all(`
            SELECT id, name
            FROM integration_connections
            WHERE is_enabled = 1
              AND leave_request_export_enabled = 1
              AND leave_export_trigger = ?
            ORDER BY id
        `, [trigger]);
    },

    enqueue(tx, event) {
        return tx.run(`
            INSERT INTO integration_outbox (
                connection_id, event_type, aggregate_type, aggregate_id,
                idempotency_key, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            event.connectionId,
            event.eventType,
            event.aggregateType,
            String(event.aggregateId),
            event.idempotencyKey,
            JSON.stringify(event.payload)
        ]);
    },

    async claim(connectionId, apiKeyId, limit, lockedUntil) {
        return db.transaction(async tx => {
            const candidates = await tx.all(`
                SELECT id
                FROM integration_outbox
                WHERE connection_id = ?
                  AND (
                    status IN ('pending', 'retry')
                    OR (status = 'leased' AND locked_until < CURRENT_TIMESTAMP)
                  )
                  AND available_at <= CURRENT_TIMESTAMP
                  AND attempts < max_attempts
                ORDER BY created_at, id
                LIMIT ?
            `, [connectionId, limit]);
            const claimedIds = [];
            for (const candidate of candidates) {
                const updated = await tx.run(`
                    UPDATE integration_outbox
                    SET status = 'leased', locked_until = ?, locked_by_api_key_id = ?,
                        attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND connection_id = ?
                      AND (
                        status IN ('pending', 'retry')
                        OR (status = 'leased' AND locked_until < CURRENT_TIMESTAMP)
                      )
                `, [lockedUntil, apiKeyId, candidate.id, connectionId]);
                if (updated.changes) claimedIds.push(candidate.id);
            }
            if (!claimedIds.length) return [];
            const placeholders = claimedIds.map(() => '?').join(', ');
            return tx.all(`
                SELECT id, event_type, aggregate_type, aggregate_id,
                       idempotency_key, payload_json, attempts, created_at
                FROM integration_outbox
                WHERE id IN (${placeholders})
                ORDER BY created_at, id
            `, claimedIds);
        });
    },

    getClaimedJob(id, connectionId, apiKeyId) {
        return db.get(`
            SELECT * FROM integration_outbox
            WHERE id = ? AND connection_id = ? AND locked_by_api_key_id = ?
              AND status = 'leased' AND locked_until > CURRENT_TIMESTAMP
        `, [id, connectionId, apiKeyId]);
    },

    complete(id, connectionId, apiKeyId, externalReference) {
        return db.run(`
            UPDATE integration_outbox
            SET status = 'completed', external_reference = ?,
                completed_at = CURRENT_TIMESTAMP, locked_until = NULL,
                locked_by_api_key_id = NULL, last_error_code = NULL,
                last_error_message = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND connection_id = ? AND locked_by_api_key_id = ?
              AND status = 'leased' AND locked_until > CURRENT_TIMESTAMP
        `, [externalReference || null, id, connectionId, apiKeyId]);
    },

    fail(id, connectionId, apiKeyId, failure) {
        return db.run(`
            UPDATE integration_outbox
            SET status = ?, available_at = ?, locked_until = NULL,
                locked_by_api_key_id = NULL, last_error_code = ?,
                last_error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND connection_id = ? AND locked_by_api_key_id = ?
              AND status = 'leased' AND locked_until > CURRENT_TIMESTAMP
        `, [
            failure.status,
            failure.availableAt,
            failure.errorCode || null,
            failure.errorMessage || null,
            id,
            connectionId,
            apiKeyId
        ]);
    }
});

module.exports = { createIntegrationOutboxRepository };
