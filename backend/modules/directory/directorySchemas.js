const { z } = require('zod');

const directoryListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    department: z.string().trim().min(1).max(255).optional(),
    sort: z.enum(['name', 'department', 'position']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc')
}).strict();

const birthdayListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10)
}).strict();

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

module.exports = {
    birthdayListQuerySchema,
    directoryListQuerySchema,
    idParamsSchema
};
