const { z } = require('zod');

const positiveId = z.coerce.number().int().positive();
const idParamsSchema = z.object({ id: positiveId }).strict();
const archiveBodySchema = z.object({
    archived: z.boolean().optional().default(true),
    reason: z.string().trim().max(1000).optional()
}).strict();
const departmentBodySchema = z.object({
    name: z.string().trim().min(1).max(255),
    source_department_name: z.string().trim().max(255).nullish()
}).strict();
const roleBodySchema = z.object({
    department_id: positiveId,
    name: z.string().trim().min(1).max(255)
}).strict();
const categoryBodySchema = z.object({
    department_id: positiveId,
    name: z.string().trim().min(1).max(255)
}).strict();
const skillBodySchema = z.object({
    department_id: positiveId,
    category_id: z.union([positiveId, z.null(), z.literal('')]).optional(),
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(4000).nullish()
}).strict();
const trainingLinksSchema = z.object({
    video_ids: z.array(positiveId).max(1000).default([])
}).strict();

module.exports = {
    idParamsSchema,
    archiveBodySchema,
    departmentBodySchema,
    roleBodySchema,
    categoryBodySchema,
    skillBodySchema,
    trainingLinksSchema
};
