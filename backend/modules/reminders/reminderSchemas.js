const { z } = require('zod');

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const reminderCreateSchema = z.object({
    text: z.string().trim().min(1).max(300)
}).strict();

const reminderUpdateSchema = z.object({
    text: z.string().trim().min(1).max(300).optional(),
    completed: z.boolean().optional(),
    pinned: z.boolean().optional()
}).strict().refine(
    body => Object.keys(body).length > 0,
    { message: 'En az bir alan güncellenmelidir.' }
);

module.exports = {
    idParamsSchema,
    reminderCreateSchema,
    reminderUpdateSchema
};
