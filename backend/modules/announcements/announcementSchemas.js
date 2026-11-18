const { z } = require('zod');

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const announcementListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(255).optional(),
    sort: z.enum(['created_at', 'visible_until', 'title']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();

const targetDepartmentsSchema = z.preprocess((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed.split(',');
    }
}, z.array(z.string().trim().min(1).max(255)).max(100));

const announcementBodySchema = z.object({
    title: z.string().trim().min(1).max(255),
    content: z.string().trim().min(1).max(50_000),
    target_department: targetDepartmentsSchema.optional().default([]),
    visible_until: z.iso.date()
}).strict();

module.exports = {
    announcementBodySchema,
    announcementListQuerySchema,
    idParamsSchema
};
