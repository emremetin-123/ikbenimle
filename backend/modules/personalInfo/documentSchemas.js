const { z } = require('zod');

const requestStatuses = ['Beklemede', 'Hazırlanıyor', 'Tamamlandı', 'Reddedildi'];

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const documentUploadBodySchema = z.object({
    user_id: z.coerce.number().int().positive(),
    title: z.string().trim().min(1).max(255)
}).strict();

const requestFieldSchema = z.object({
    label: z.string().trim().min(1).max(255),
    field_key: z.string().trim().regex(/^[a-zA-Z0-9_]{1,100}$/).optional().or(z.literal('')),
    field_type: z.enum(['text', 'textarea', 'date', 'number']).default('text'),
    is_required: z.boolean().optional().default(false),
    order_index: z.coerce.number().int().min(0).max(10_000).optional(),
    placeholder: z.string().trim().max(500).optional().default('')
}).strict();

const requestTypeBodySchema = z.object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5_000).optional().default(''),
    is_active: z.boolean().optional().default(true),
    order_index: z.coerce.number().int().min(0).max(10_000).optional().default(0),
    fields: z.array(requestFieldSchema).max(100).optional().default([])
}).strict();

const documentRequestBodySchema = z.object({
    type_id: z.coerce.number().int().positive(),
    answers: z.record(
        z.string().regex(/^[a-zA-Z0-9_]{1,100}$/),
        z.union([z.string().trim().max(10_000), z.number().finite()])
    ).refine((answers) => Object.keys(answers).length <= 100, {
        message: 'En fazla 100 cevap alanı gönderilebilir.'
    }).optional().default({})
}).strict();

const documentRequestStatusBodySchema = z.object({
    status: z.enum(requestStatuses),
    hr_note: z.string().trim().max(10_000).optional().default('')
}).strict();

module.exports = {
    documentRequestBodySchema,
    documentRequestStatusBodySchema,
    documentUploadBodySchema,
    idParamsSchema,
    requestStatuses,
    requestTypeBodySchema
};
