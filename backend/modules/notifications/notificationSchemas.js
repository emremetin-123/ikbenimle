const { z } = require('zod');

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const appUrlSchema = z.string().trim().min(1).max(500).refine(
    value => value.startsWith('/') || /^https:\/\/[^ ]+$/i.test(value),
    'Geçerli bir uygulama yolu veya HTTPS adresi girin.'
);
const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();
const templateParamsSchema = z.object({
    key: z.string().trim().min(1).max(100).regex(/^[a-z0-9_]+$/)
}).strict();
const listQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    status: z.enum(['all', 'active', 'passive']).default('all'),
    sort: z.enum(['scheduled_time', 'title', 'created_at']).default('scheduled_time'),
    order: z.enum(['asc', 'desc']).default('asc')
}).strict();
const templateListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    status: z.enum(['all', 'active', 'passive']).default('all')
}).strict();
const subscriptionListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    status: z.enum(['all', 'active', 'passive']).default('all')
}).strict();
const subscriptionSchema = z.object({
    subscription: z.object({
        endpoint: z.string().url().max(4000),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({
            p256dh: z.string().min(1).max(1000),
            auth: z.string().min(1).max(1000)
        }).strict()
    }).strict(),
    deviceLabel: z.string().trim().max(120).optional().default('')
}).strict();
const unsubscribeSchema = z.object({
    endpoint: z.string().url().max(4000)
}).strict();
const sendSchema = z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(1000),
    url: appUrlSchema.default('/employee/anasayfa'),
    target: z.enum(['all', 'department', 'users']).default('all'),
    department: z.string().trim().max(150).optional().default(''),
    userIds: z.array(z.coerce.number().int().positive()).max(500).optional().default([])
}).strict().superRefine((value, context) => {
    if (value.target === 'department' && !value.department) {
        context.addIssue({
            code: 'custom',
            path: ['department'],
            message: 'Departman seçimi zorunludur.'
        });
    }
    if (value.target === 'users' && value.userIds.length === 0) {
        context.addIssue({
            code: 'custom',
            path: ['userIds'],
            message: 'En az bir kullanıcı seçilmelidir.'
        });
    }
});
const routineSchema = z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(1000),
    url: appUrlSchema.default('/employee/anasayfa'),
    target: z.enum(['all', 'department']).default('all'),
    department: z.string().trim().max(150).nullable().optional().default(null),
    schedule_type: z.enum(['daily', 'once']).default('daily'),
    scheduled_date: z.union([dateSchema, z.literal(''), z.null()]).optional().default(null),
    scheduled_time: timeSchema.default('09:00'),
    is_active: z.boolean().default(true)
}).strict().superRefine((value, context) => {
    if (value.target === 'department' && !value.department) {
        context.addIssue({
            code: 'custom',
            path: ['department'],
            message: 'Departman seçimi zorunludur.'
        });
    }
    if (value.schedule_type === 'once' && !value.scheduled_date) {
        context.addIssue({
            code: 'custom',
            path: ['scheduled_date'],
            message: 'Tarih seçimi zorunludur.'
        });
    }
});
const templatePatchSchema = z.object({
    enabled: z.boolean(),
    time: z.union([timeSchema, z.literal('')]).optional(),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(1000),
    url: appUrlSchema
}).strict();
const settingsSchema = z.object({
    vapid_public_key: z.string().trim().max(1000),
    vapid_subject: z.string().trim().max(320).refine(
        value => /^mailto:[^@\s]+@[^@\s]+$/i.test(value)
            || /^https:\/\/[^ ]+$/i.test(value),
        'Gönderen bilgisi mailto: veya HTTPS adresi olmalıdır.'
    ),
    push_mood_reminder_time: timeSchema.optional(),
    push_mood_reminder_enabled: z.enum(['true', 'false']).optional(),
    push_mood_reminder_title: z.string().trim().max(120).optional(),
    push_mood_reminder_body: z.string().trim().max(1000).optional()
}).strict();

module.exports = {
    idParamsSchema,
    listQuerySchema,
    routineSchema,
    sendSchema,
    settingsSchema,
    subscriptionSchema,
    subscriptionListQuerySchema,
    templateListQuerySchema,
    templateParamsSchema,
    templatePatchSchema,
    unsubscribeSchema
};
