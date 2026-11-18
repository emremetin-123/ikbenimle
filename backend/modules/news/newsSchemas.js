const { z } = require('zod');

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const newsListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(255).optional(),
    sort: z.enum(['created_at', 'title']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();

const newsBodySchema = z.object({
    title: z.string().trim().min(1).max(255),
    content: z.string().trim().min(1).max(50_000)
}).strict();

module.exports = {
    idParamsSchema,
    newsBodySchema,
    newsListQuerySchema
};
