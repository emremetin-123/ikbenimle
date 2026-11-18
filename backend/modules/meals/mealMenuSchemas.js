const { z } = require('zod');
const { getTodayIso } = require('./menuParser');

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Geçerli bir tarih girin.');
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Geçerli bir ay seçin.');
const dateParamsSchema = z.object({ date: isoDateSchema }).strict();
const monthQuerySchema = z.object({
    month: monthSchema.default(() => getTodayIso().slice(0, 7)),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(31)
}).strict();
const ratingSummaryQuerySchema = z.object({
    month: monthSchema.default(() => getTodayIso().slice(0, 7))
}).strict();
const ratingRowsQuerySchema = z.object({
    month: monthSchema.default(() => getTodayIso().slice(0, 7)),
    date: isoDateSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25)
}).strict();
const ratingBodySchema = z.object({
    food_score: z.number().int().min(1).max(5),
    staff_score: z.number().int().min(1).max(5),
    cleanliness_score: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).nullable().optional().default(null)
}).strict();
const bulkBodySchema = z.object({
    source_file: z.string().trim().max(255).nullable().optional().default(null),
    menus: z.array(z.object({
        meal_date: isoDateSchema,
        items: z.array(z.string().trim().min(1).max(250)).min(1).max(20)
    }).strict()).min(1).max(31)
}).strict();
const parsePdfBodySchema = z.object({ month: monthSchema }).strict();

module.exports = {
    bulkBodySchema,
    dateParamsSchema,
    monthQuerySchema,
    parsePdfBodySchema,
    ratingBodySchema,
    ratingRowsQuerySchema,
    ratingSummaryQuerySchema
};
