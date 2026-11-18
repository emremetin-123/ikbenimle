const { createUploadStorageService } = require('../../services/uploadStorageService');
const { createDocumentRepository } = require('./documentRepository');

const logCleanupFailure = (event, error, context = {}) => {
    console.error(JSON.stringify({
        level: 'error',
        event,
        ...context,
        message: error.message
    }));
};

const createDocumentFileService = (db, storage = createUploadStorageService()) => {
    const repository = createDocumentRepository(db);
    return ({
    async uploadDocument({ file, userId, title, adminId }) {
        let storedFile;
        try {
            storedFile = await storage.store(file, 'documents');
            await repository.insertDocument({
                userId,
                title,
                filePath: storedFile.filePath,
                adminId,
                provider: storedFile.provider,
                storageKey: storedFile.storageKey
            });
        } catch (error) {
            if (storedFile) {
                await storage.remove(storedFile).catch(cleanupError => {
                    logCleanupFailure('document_upload_compensation_failed', cleanupError);
                });
            }
            throw error;
        }
    },

    async deleteDocument(id) {
        const document = await repository.getDocumentFile(id);
        if (!document) return;
        await repository.deleteDocument(id);
        await storage.remove({
            filePath: document.file_path,
            provider: document.storage_provider,
            storageKey: document.storage_key
        }).catch(error => {
            logCleanupFailure('document_delete_storage_cleanup_failed', error, {
                document_id: Number(id)
            });
        });
    },

    async uploadRequestResponse({ requestId, file, adminId }) {
        const previous = await repository.getRequestResponseFile(requestId);
        if (!previous) return null;

        let storedFile;
        try {
            storedFile = await storage.store(file, 'documents');
            const update = await repository.updateRequestResponseFile(requestId, {
                filePath: storedFile.filePath,
                fileName: file.originalname,
                provider: storedFile.provider,
                storageKey: storedFile.storageKey,
                adminId
            });
            if (!update.changes) throw new Error('DOCUMENT_REQUEST_UPDATE_FAILED');
        } catch (error) {
            if (storedFile) {
                await storage.remove(storedFile).catch(cleanupError => {
                    logCleanupFailure('document_response_upload_compensation_failed', cleanupError);
                });
            }
            throw error;
        }

        if (previous.response_file_path) {
            await storage.remove({
                filePath: previous.response_file_path,
                provider: previous.response_storage_provider,
                storageKey: previous.response_storage_key
            }).catch(error => {
                logCleanupFailure('document_response_replacement_cleanup_failed', error, {
                    document_request_id: Number(requestId)
                });
            });
        }
        return storedFile;
    }
    });
};

module.exports = { createDocumentFileService };
