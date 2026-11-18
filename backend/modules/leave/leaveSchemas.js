const { z } = require('zod');
const { LEAVE_TYPES, VALID_STATUSES } = require('./leaveConstants');

const listQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(VALID_STATUSES).optional(),
    sort: z.enum(['created_at', 'start_datetime']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();

const adminListQuerySchema = listQuerySchema.extend({
    search: z.string().trim().max(255).optional(),
    department: z.string().trim().min(1).max(255).optional(),
    sort: z.enum(['created_at', 'start_datetime', 'requester_name']).default('created_at')
}).strict();

const dateTimeSchema = z.string().trim().min(1).max(40)
    .refine(value => !Number.isNaN(new Date(value).getTime()), 'Geçerli bir tarih girin.');

const createBodySchema = z.object({
    leave_type: z.enum(LEAVE_TYPES),
    start_datetime: dateTimeSchema,
    end_datetime: dateTimeSchema,
    return_datetime: dateTimeSchema,
    duration_type: z.enum(['Gün', 'Saat']),
    description: z.string().trim().max(2000).optional().default('')
}).strict();

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const statusBodySchema = z.object({
    status: z.enum(VALID_STATUSES)
}).strict();

module.exports = {
    listQuerySchema,
    adminListQuerySchema,
    createBodySchema,
    idParamsSchema,
    statusBodySchema
};
