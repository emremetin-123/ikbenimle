const { z } = require('zod');

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
const employeeJobListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(255).optional(),
    sort: z.enum(['created_at', 'title', 'deadline_date']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();
const adminJobListQuerySchema = employeeJobListQuerySchema.extend({
    status: z.enum(['active', 'inactive']).optional()
}).strict();
const applicationListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(255).optional(),
    status: z.enum(['pending', 'reviewing', 'approved', 'rejected']).optional(),
    sort: z.enum(['applied_at', 'name']).default('applied_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();
const myApplicationListQuerySchema = applicationListQuerySchema.omit({ sort: true }).extend({
    sort: z.enum(['applied_at', 'title']).default('applied_at')
}).strict();
const optionalText = max => z.string().trim().max(max)
    .transform(value => value || null).nullable().optional().default(null);
const optionalDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .transform(value => value || null).nullable().optional().default(null);
const jobBodySchema = z.object({
    title: z.string().trim().min(1).max(255),
    image_url: optionalText(2000),
    publish_date: optionalDate,
    deadline_date: optionalDate,
    position_type: optionalText(255),
    location: optionalText(255),
    manager_name: optionalText(255),
    work_model: optionalText(255),
    job_description: optionalText(10000),
    qualifications: optionalText(10000),
    prerequisites: optionalText(10000),
    additional_notes: optionalText(10000),
    status: z.enum(['active', 'inactive']).default('active')
}).strict().superRefine((value, context) => {
    if (value.publish_date && value.deadline_date && value.deadline_date < value.publish_date) {
        context.addIssue({
            code: 'custom',
            path: ['deadline_date'],
            message: 'Son başvuru tarihi ilan tarihinden önce olamaz.'
        });
    }
});
const applicationStatusBodySchema = z.object({
    status: z.enum(['pending', 'reviewing', 'approved', 'rejected'])
}).strict();

module.exports = {
    adminJobListQuerySchema,
    applicationListQuerySchema,
    applicationStatusBodySchema,
    employeeJobListQuerySchema,
    idParamsSchema,
    jobBodySchema,
    myApplicationListQuerySchema
};
