const { createHash } = require('node:crypto');
const { AppError } = require('../../core/http');
const { createPayrollRepository } = require('./payrollRepository');
const { createPayrollStorage } = require('./payrollStorage');
const { createIntegrationRepository } = require('./integrationRepository');

const createPayrollService = (db, storage = createPayrollStorage()) => {
    const repository = createPayrollRepository(db);
    const integrations = createIntegrationRepository(db);
    return {
        async upload(integration, body, file, requestId) {
            if (!file) throw new AppError(400, 'PAYROLL_FILE_REQUIRED', 'Bordro PDF dosyası gereklidir.');
            if (file.buffer.length < 12 || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
                throw new AppError(400, 'PAYROLL_INVALID_PDF', 'Dosya içeriği PDF değil.');
            }
            const hash = createHash('sha256').update(file.buffer).digest('hex');
            let stored;
            let previous;
            let result;
            try {
                result = await repository.transaction(async tx => {
                    await repository.lock(tx, integration.connectionId);
                    const employee = await repository.employee(tx, integration.connectionId, body.external_employee_id);
                    if (!employee) throw new AppError(409, 'PAYROLL_EMPLOYEE_NOT_MAPPED', 'Önce çalışanı bu bağlantı üzerinden aktarın.');
                    const existing = await repository.existing(tx, integration.connectionId, body.external_payroll_id);
                    if (existing) {
                        if (Number(existing.user_id) !== Number(employee.user_id) || existing.period !== body.period) {
                            throw new AppError(409, 'PAYROLL_IDENTITY_CONFLICT', 'Bordro kimliği başka çalışan veya döneme ait.');
                        }
                        if (Number(existing.revision) === body.revision && existing.content_hash === hash) {
                            return { document_id: Number(existing.document_id), revision: body.revision, replayed: true };
                        }
                        if (body.revision <= Number(existing.revision)) {
                            throw new AppError(409, 'PAYROLL_REVISION_CONFLICT', 'Düzeltilmiş bordro için daha yüksek revizyon gönderin.');
                        }
                    } else if (await repository.period(tx, integration.connectionId, employee.user_id, body.period)) {
                        throw new AppError(409, 'PAYROLL_PERIOD_CONFLICT', 'Bu dönem için mevcut bordro kimliğini kullanın.');
                    }
                    stored = await storage.store(file);
                    const data = { ...body, connectionId: integration.connectionId, userId: employee.user_id, hash };
                    const documentId = existing
                        ? await repository.replace(tx, existing, data, stored)
                        : await repository.create(tx, data, stored);
                    await integrations.audit({ connectionId: integration.connectionId, apiKeyId: integration.apiKeyId,
                        direction: 'inbound', action: 'payrolls.upsert', status: 'success',
                        entityType: 'document', entityId: String(documentId), requestId,
                        details: { revision: body.revision, replaced: Boolean(existing) } }, tx);
                    await integrations.markConnectionSuccess(tx, integration.connectionId);
                    previous = existing;
                    return { document_id: documentId, revision: body.revision, replayed: false };
                });
            } catch (error) {
                if (stored) await storage.remove(stored).catch(() => console.error('PAYROLL_UPLOAD_CLEANUP_FAILED'));
                throw error;
            }
            if (previous) await storage.remove({ filePath: previous.file_path, provider: previous.storage_provider,
                storageKey: previous.storage_key }).catch(() => console.error('PAYROLL_REPLACEMENT_CLEANUP_FAILED'));
            return result;
        }
    };
};
module.exports = { createPayrollService };
