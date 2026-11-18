const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { z } = require('zod');
const { AppError, asyncHandler } = require('../../core/http');
const { validate } = require('../../core/validation');
const { requireIntegrationScope } = require('./integrationAuth');
const { createPayrollService } = require('./payrollService');

const payrollBodySchema = z.object({
    external_employee_id: z.string().trim().min(1).max(100),
    external_payroll_id: z.string().trim().min(1).max(100),
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    revision: z.coerce.number().int().min(1).max(2147483647).default(1)
}).strict();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 4, fieldSize: 1024, parts: 5 },
    fileFilter: (_req, file, callback) => {
        if (file.mimetype !== 'application/pdf' || path.extname(file.originalname).toLowerCase() !== '.pdf') {
            return callback(new AppError(400, 'PAYROLL_INVALID_PDF', 'Yalnız PDF dosyası gönderilebilir.'));
        }
        callback(null, true);
    }
}).single('file');

module.exports = (db, options = {}) => {
    const router = express.Router();
    const service = createPayrollService(db, options.storage);
    router.post('/payrolls/upsert', requireIntegrationScope('payrolls:write'),
        (req, res, next) => upload(req, res, error => {
            if (error instanceof multer.MulterError) {
                return next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
                    'PAYROLL_UPLOAD_REJECTED', 'Tek PDF dosyası, en fazla 20 MB ve geçerli form alanları gönderin.'));
            }
            next(error);
        }), validate({ body: payrollBodySchema }), asyncHandler(async (req, res) => {
            const result = await service.upload(req.integration, req.body, req.file, req.id);
            if (result.replayed) res.setHeader('X-Idempotent-Replay', 'true');
            res.json(result);
        }));
    return router;
};
