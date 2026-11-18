const { z } = require('zod');

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const categoryListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    search: z.string().trim().max(255).optional(),
    sort: z.enum(['order_index', 'name']).default('order_index'),
    order: z.enum(['asc', 'desc']).default('asc')
}).strict();

const itemListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    subCategory: z.string().trim().max(255).optional(),
    featured: z.enum(['all', 'featured']).default('all'),
    sort: z.enum(['order_index', 'question']).default('order_index'),
    order: z.enum(['asc', 'desc']).default('asc')
}).strict();

const categoryBodySchema = z.object({
    name: z.string().trim().min(1).max(255),
    order_index: z.coerce.number().int().min(0).max(100000).default(0)
}).strict();

const nullableText = max => z.string().trim().max(max)
    .transform(value => value || null)
    .nullable()
    .optional()
    .default(null);

const itemBodySchema = z.object({
    category_id: z.coerce.number().int().positive(),
    sub_category: nullableText(255),
    question: z.string().trim().min(1).max(2000),
    answer: z.string().trim().min(1).max(20000),
    is_featured: z.boolean().default(false),
    order_index: z.coerce.number().int().min(0).max(100000).default(0)
}).strict();

module.exports = {
    categoryBodySchema,
    categoryListQuerySchema,
    idParamsSchema,
    itemBodySchema,
    itemListQuerySchema
};
