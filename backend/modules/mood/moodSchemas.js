const { z } = require('zod');

const MOODS = {
    great: { score: 5, label: 'Harika' },
    good: { score: 4, label: 'İyi' },
    okay: { score: 3, label: 'Normal' },
    tired: { score: 2, label: 'Yorgun' },
    sad: { score: 1, label: 'Üzgün' }
};
const MOOD_REASONS = {
    workload: 'İş yükü',
    personal: 'Kişisel sebepler',
    health: 'Sağlık',
    work_environment: 'İş ortamı',
    manager_communication: 'Yönetici / iletişim',
    transportation: 'Servis / ulaşım',
    cafeteria: 'Yemekhane',
    other: 'Diğer'
};
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const validateRange = (value, context) => {
    if (value.from && value.to && value.from > value.to) {
        context.addIssue({
            code: 'custom',
            path: ['to'],
            message: 'Bitiş tarihi başlangıç tarihinden önce olamaz.'
        });
    }
};
const reportRangeSchema = z.object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    department: z.string().trim().max(150).optional().default('')
}).strict().superRefine(validateRange);
const reportQueryShape = {
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    department: z.string().trim().max(150).optional().default(''),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    sort: z.enum(['mood_date', 'mood_score', 'response_count']).default('mood_date'),
    order: z.enum(['asc', 'desc']).default('desc')
};
const reportQuerySchema = z.object(reportQueryShape).strict().superRefine(validateRange);
const callbackQuerySchema = z.object({
    ...reportQueryShape,
    sort: z.enum(['requested_date', 'created_at', 'name']).default('requested_date')
}).strict().superRefine(validateRange);
const moodBodySchema = z.object({
    mood_id: z.enum(Object.keys(MOODS)),
    reason_key: z.enum(Object.keys(MOOD_REASONS)).nullable().optional().default(null)
}).strict();
const emptyBodySchema = z.object({}).strict();

module.exports = {
    callbackQuerySchema,
    emptyBodySchema,
    MOODS,
    MOOD_REASONS,
    moodBodySchema,
    reportQuerySchema,
    reportRangeSchema
};
