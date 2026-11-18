const { AppError } = require('../../core/http');

const isUniqueViolation = (error) => (
    error?.code === '23505'
    || error?.code === 'SQLITE_CONSTRAINT'
    || String(error?.message || '').includes('UNIQUE constraint failed')
);

const parseResponse = (record) => {
    try {
        return JSON.parse(record.response_json);
    } catch {
        return {};
    }
};

const isStaleSourceRecord = (existingValue, incomingValue) => {
    if (!existingValue || !incomingValue) return false;
    const existing = new Date(existingValue).getTime();
    const incoming = new Date(incomingValue).getTime();
    return Number.isFinite(existing) && Number.isFinite(incoming) && incoming <= existing;
};

const futureSqlTimestamp = (milliseconds) => (
    new Date(Date.now() + milliseconds).toISOString().replace('T', ' ').replace('Z', '')
);

function createIntegrationSyncService(db, repository) {
    const executeIdempotent = async ({ integration, idempotencyKey, method, path, action, work }) => {
        if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
            throw new AppError(
                400,
                'IDEMPOTENCY_KEY_REQUIRED',
                'Mutasyon isteklerinde 16-128 karakterlik Idempotency-Key başlığı zorunludur.'
            );
        }
        const existing = await repository.findIdempotencyRecord(
            integration.connectionId,
            method,
            path,
            idempotencyKey
        );
        if (existing) {
            return { response: parseResponse(existing), replayed: true };
        }

        try {
            const response = await db.transaction(async tx => {
                const result = await work(tx);
                await repository.createIdempotencyRecord(tx, {
                    connectionId: integration.connectionId,
                    apiKeyId: integration.apiKeyId,
                    idempotencyKey,
                    method,
                    path,
                    responseStatus: 200,
                    response: result,
                    expiresAt: futureSqlTimestamp(30 * 24 * 60 * 60 * 1000)
                });
                await repository.markConnectionSuccess(tx, integration.connectionId);
                await repository.audit({
                    connectionId: integration.connectionId,
                    apiKeyId: integration.apiKeyId,
                    direction: 'inbound',
                    action,
                    status: 'success',
                    details: result.summary || null
                }, tx);
                return result;
            });
            return { response, replayed: false };
        } catch (error) {
            if (isUniqueViolation(error)) {
                const duplicate = await repository.findIdempotencyRecord(
                    integration.connectionId,
                    method,
                    path,
                    idempotencyKey
                );
                if (duplicate) return { response: parseResponse(duplicate), replayed: true };
            }
            await repository.audit({
                connectionId: integration.connectionId,
                apiKeyId: integration.apiKeyId,
                direction: 'inbound',
                action,
                status: 'failed',
                details: { error: error.code || 'INTEGRATION_SYNC_FAILED' }
            }).catch(() => undefined);
            throw error;
        }
    };

    return {
        async upsertEmployees(integration, idempotencyKey, employees) {
            if (!integration.employeeSyncEnabled) {
                throw new AppError(409, 'EMPLOYEE_SYNC_DISABLED', 'Çalışan senkronizasyonu bu bağlantıda kapalı.');
            }
            const externalIds = new Set();
            const employeeIds = new Set();
            for (const employee of employees) {
                if (externalIds.has(employee.external_employee_id) || employeeIds.has(employee.employee_id)) {
                    throw new AppError(400, 'DUPLICATE_EMPLOYEE_IN_BATCH', 'Aynı çalışan toplu istek içinde birden fazla kez gönderilemez.');
                }
                externalIds.add(employee.external_employee_id);
                employeeIds.add(employee.employee_id);
            }

            return executeIdempotent({
                integration,
                idempotencyKey,
                method: 'POST',
                path: '/api/integrations/v1/employees/upsert',
                action: 'employees.upsert',
                work: async tx => {
                    const connection = await tx.get(
                        'SELECT default_permissions_json FROM integration_connections WHERE id = ?',
                        [integration.connectionId]
                    );
                    let defaultPermissions = [];
                    try {
                        defaultPermissions = JSON.parse(connection?.default_permissions_json || '[]');
                    } catch {
                        defaultPermissions = [];
                    }
                    const summary = {
                        received: employees.length,
                        created: 0,
                        updated: 0,
                        skipped_stale: 0,
                        activation_required: 0,
                        unresolved_managers: 0
                    };
                    const processed = [];

                    for (const employee of employees) {
                        const mapping = await repository.findEmployeeMapping(
                            tx,
                            integration.connectionId,
                            employee.external_employee_id
                        );
                        if (mapping && isStaleSourceRecord(mapping.source_updated_at, employee.source_updated_at)) {
                            summary.skipped_stale += 1;
                            continue;
                        }
                        let user = mapping
                            ? await tx.get('SELECT * FROM users WHERE id = ?', [mapping.user_id])
                            : await repository.findUserByEmployeeId(tx, employee.employee_id);
                        if (user?.role === 'admin') {
                            throw new AppError(
                                409,
                                'PRIVILEGED_USER_SYNC_DENIED',
                                'ERP senkronizasyonu yönetici hesabını değiştiremez.'
                            );
                        }
                        if (!user) {
                            const created = await repository.createEmployee(tx, employee, defaultPermissions);
                            user = { id: created.lastID, password_hash: null, role: 'employee' };
                            summary.created += 1;
                        } else {
                            await repository.updateEmployee(tx, user.id, employee);
                            summary.updated += 1;
                        }
                        if (!user.password_hash) summary.activation_required += 1;
                        await repository.upsertPersonalInfo(tx, user.id, employee);
                        await repository.upsertEmployeeMapping(
                            tx,
                            integration.connectionId,
                            employee.external_employee_id,
                            user.id,
                            employee.source_updated_at
                        );
                        if (employee.status === 'passive') {
                            await tx.run(
                                'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
                                [user.id]
                            );
                        }
                        processed.push({ employee, userId: user.id });
                    }

                    for (const item of processed) {
                        if (item.employee.manager_employee_id === null) {
                            await repository.updateEmployeeManager(tx, item.userId, null);
                            continue;
                        }
                        const manager = await repository.findUserByEmployeeId(
                            tx,
                            item.employee.manager_employee_id
                        );
                        if (!manager || manager.id === item.userId) {
                            summary.unresolved_managers += 1;
                            continue;
                        }
                        await repository.updateEmployeeManager(tx, item.userId, manager.id);
                    }

                    return {
                        success: true,
                        summary,
                        note: summary.activation_required
                            ? 'Yeni kullanıcılar parola belirlenene kadar giriş yapamaz.'
                            : undefined
                    };
                }
            });
        },

        async upsertLeaveBalances(integration, idempotencyKey, balances) {
            if (!integration.leaveBalanceSyncEnabled) {
                throw new AppError(409, 'LEAVE_BALANCE_SYNC_DISABLED', 'İzin bakiyesi senkronizasyonu bu bağlantıda kapalı.');
            }
            const externalIds = new Set();
            for (const balance of balances) {
                if (externalIds.has(balance.external_employee_id)) {
                    throw new AppError(400, 'DUPLICATE_BALANCE_IN_BATCH', 'Aynı çalışanın bakiyesi toplu istek içinde tekrarlanamaz.');
                }
                externalIds.add(balance.external_employee_id);
            }

            return executeIdempotent({
                integration,
                idempotencyKey,
                method: 'POST',
                path: '/api/integrations/v1/leave-balances/upsert',
                action: 'leave_balances.upsert',
                work: async tx => {
                    const summary = { received: balances.length, updated: 0, skipped_stale: 0 };
                    for (const balance of balances) {
                        const mapping = await repository.findEmployeeMapping(
                            tx,
                            integration.connectionId,
                            balance.external_employee_id
                        );
                        if (!mapping) {
                            throw new AppError(
                                409,
                                'EMPLOYEE_MAPPING_REQUIRED',
                                `İzin bakiyesi için çalışan eşleştirmesi bulunamadı: ${balance.external_employee_id}`
                            );
                        }
                        const current = await tx.get(`
                            SELECT source_updated_at FROM integration_leave_balances
                            WHERE connection_id = ? AND user_id = ?
                        `, [integration.connectionId, mapping.user_id]);
                        if (current && isStaleSourceRecord(current.source_updated_at, balance.source_updated_at)) {
                            summary.skipped_stale += 1;
                            continue;
                        }
                        await repository.upsertLeaveBalance(
                            tx,
                            integration.connectionId,
                            mapping,
                            balance
                        );
                        summary.updated += 1;
                    }
                    return { success: true, summary };
                }
            });
        },

        async getUserLeaveBalance(userId) {
            const row = await repository.getUserLeaveBalance(userId);
            if (!row) return { available: false, balance_days: null };
            const staleHours = Number(process.env.INTEGRATION_BALANCE_STALE_HOURS || 36);
            const ageMs = Date.now() - new Date(row.updated_at).getTime();
            return {
                available: true,
                balance_days: Number(row.balance_days),
                as_of_date: row.as_of_date,
                source_updated_at: row.source_updated_at,
                source_name: row.source_name,
                stale: Number.isFinite(ageMs) && ageMs > staleHours * 60 * 60 * 1000
            };
        }
    };
}

module.exports = { createIntegrationSyncService };
