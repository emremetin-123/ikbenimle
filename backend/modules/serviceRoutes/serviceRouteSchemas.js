const { z } = require('zod');

const listQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(255).optional(),
    status: z.enum(['all', 'active', 'inactive']).default('all'),
    sort: z.enum(['name', 'created_at', 'updated_at']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc')
}).strict();
const idParamsSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
const optionalText = max => z.string().trim().max(max)
    .transform(value => value || null).nullable().optional().default(null);
const stopSchema = z.object({
    id: z.coerce.number().int().positive().optional(),
    route_id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(255),
    arrival_time: z.union([z.literal(''), z.string().regex(/^\d{2}:\d{2}$/)])
        .transform(value => value || null).nullable().optional().default(null),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    order_index: z.coerce.number().int().min(0).optional()
}).strict();
const routeBodySchema = z.object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(255),
    direction: optionalText(255),
    plate: optionalText(50),
    driver_name: optionalText(255),
    driver_phone: optionalText(50),
    notes: optionalText(5000),
    color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).default('#2563eb'),
    is_active: z.boolean().default(true),
    stops: z.array(stopSchema).min(2).max(100)
}).strict();

module.exports = { idParamsSchema, listQuerySchema, routeBodySchema };
