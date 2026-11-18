const express = require('express');
const { z } = require('zod');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { docUpload, verifyUploadSignatures } = require('../../config/multer');
const { createDocumentFileService } = require('./documentFileService');
const { createDocumentRepository } = require('./documentRepository');
const { createDocumentService } = require('./documentService');
const { validate } = require('../../core/validation');
const { asyncHandler } = require('../../core/http');
const {
    documentRequestBodySchema,
    documentRequestStatusBodySchema,
    documentUploadBodySchema,
    idParamsSchema,
    requestTypeBodySchema
} = require('./documentSchemas');

const documentRequestListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional(),
    status: z.string().trim().max(50).optional(),
    type: z.coerce.number().int().positive().optional(),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    sort: z.enum(['created_at', 'status', 'type_name', 'user_name']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();
const employeeDocumentRequestListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    sort: z.enum(['created_at', 'status', 'type_name']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();
const employeeDocumentListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    sort: z.enum(['upload_date', 'title']).default('upload_date'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();
const optionListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional()
}).strict();

const legacyMutation = handler => async (req, res) => {
    try {
        return await handler(req, res);
    } catch (error) {
        if (error?.status) return res.status(error.status).json({ error: error.message });
        return res.status(500).json({
            error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : error.message
        });
    }
};

module.exports = db => {
    const router = express.Router();
    const repository = createDocumentRepository(db);
    const service = createDocumentService(repository);
    const documentFiles = createDocumentFileService(db);
    const admin = [authenticateToken, requirePermission('manage_documents')];

    router.get('/documents', authenticateToken,
        validate({ query: employeeDocumentListQuerySchema }),
        asyncHandler(async (req, res) => res.json(await service.listDocuments(req.user.id, req.query))));

    router.post('/admin/documents', ...admin, docUpload.single('file'), verifyUploadSignatures,
        validate({ body: documentUploadBodySchema }), legacyMutation(async (req, res) => {
            if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi' });
            await documentFiles.uploadDocument({
                file: req.file,
                userId: req.body.user_id,
                title: req.body.title,
                adminId: req.user.id
            });
            return res.json({ success: true });
        }));

    router.delete('/admin/documents/:id', ...admin, validate({ params: idParamsSchema }),
        legacyMutation(async (req, res) => {
            await documentFiles.deleteDocument(req.params.id);
            return res.json({ success: true });
        }));

    router.get('/document-request-types', authenticateToken,
        legacyMutation(async (_req, res) => res.json(await service.getRequestTypes(true))));
    router.get('/admin/document-request-types', ...admin,
        legacyMutation(async (_req, res) => res.json(await service.getRequestTypes(false))));

    router.get('/admin/document-user-options', ...admin,
        validate({ query: optionListQuerySchema }),
        asyncHandler(async (req, res) => res.json(await service.listUserOptions(req.query))));

    router.post('/admin/document-request-types', ...admin,
        validate({ body: requestTypeBodySchema }), legacyMutation(async (req, res) => {
            const id = await service.createRequestType(req.body);
            return res.json({ success: true, id });
        }));
    router.put('/admin/document-request-types/:id', ...admin,
        validate({ params: idParamsSchema, body: requestTypeBodySchema }),
        legacyMutation(async (req, res) => {
            await service.updateRequestType(req.params.id, req.body);
            return res.json({ success: true });
        }));

    router.get('/document-requests', authenticateToken,
        validate({ query: employeeDocumentRequestListQuerySchema }),
        asyncHandler(async (req, res) => (
            res.json(await service.listEmployeeRequests(req.user.id, req.query))
        )));
    router.post('/document-requests', authenticateToken,
        validate({ body: documentRequestBodySchema }), legacyMutation(async (req, res) => {
            const id = await service.createDocumentRequest(req.user.id, req.body);
            return res.json({ success: true, id });
        }));

    router.get('/admin/document-requests', ...admin,
        validate({ query: documentRequestListQuerySchema }),
        asyncHandler(async (req, res) => res.json(await service.listAdminRequests(req.query))));
    router.put('/admin/document-requests/:id', ...admin,
        validate({ params: idParamsSchema, body: documentRequestStatusBodySchema }),
        legacyMutation(async (req, res) => {
            await service.updateRequestStatus(req.params.id, req.body, req.user.id);
            return res.json({ success: true });
        }));
    router.post('/admin/document-requests/:id/file', ...admin,
        docUpload.single('file'), verifyUploadSignatures, validate({ params: idParamsSchema }),
        legacyMutation(async (req, res) => {
            if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi' });
            const storedFile = await documentFiles.uploadRequestResponse({
                requestId: req.params.id,
                file: req.file,
                adminId: req.user.id
            });
            if (!storedFile) return res.status(404).json({ error: 'Belge talebi bulunamadı' });
            return res.json({ success: true, file_path: storedFile.filePath });
        }));

    return router;
};
