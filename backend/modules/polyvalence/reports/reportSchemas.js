const { z } = require('zod');

const periodIdParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const reportDashboardQuerySchema = z.object({
    group_key: z.string().regex(/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/).optional(),
    department_id: z.union([z.literal('all'), z.coerce.number().int().positive()]).optional(),
    period_id: z.coerce.number().int().positive().optional(),
    position: z.string().trim().min(1).max(255).optional()
}).strict();

const reportExportQuerySchema = z.object({
    mode: z.enum(['detail', 'matrix']).optional().default('detail')
}).strict();

const gapTrainingAssignmentBodySchema = z.object({
    skill_id: z.coerce.number().int().positive(),
    user_ids: z.array(z.coerce.number().int().positive()).min(1).max(500)
        .transform((values) => [...new Set(values)]),
    video_id: z.coerce.number().int().positive().nullable().optional()
}).strict();

module.exports = {
    gapTrainingAssignmentBodySchema,
    periodIdParamsSchema,
    reportDashboardQuerySchema,
    reportExportQuerySchema
};
