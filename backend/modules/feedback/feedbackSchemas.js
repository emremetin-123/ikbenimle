const { z } = require('zod');
const { DECISIONS } = require('./feedbackPolicy');

const feedbackStatuses = [
    'pending',
    'assigned',
    'waiting_opinion',
    'in_review',
    'approved',
    'rejected',
    'in_progress',
    'resolved'
];
const positiveId = z.coerce.number().int().positive();
const idParamsSchema = z.object({ id: positiveId }).strict();
const commentAttachmentParamsSchema = idParamsSchema.extend({ commentId: positiveId });
const optionalText = (max) => z.string().trim().max(max).optional().default('');
const nullableText = (max) => z.union([
    z.null(),
    z.string().trim().max(max)
]).optional().default(null);
const multipartBoolean = z.preprocess(
    (value) => {
        if (value === true || value === 'true') return true;
        if (value === false || value === 'false' || value === undefined) return false;
        return value;
    },
    z.boolean()
);

const improveTextBodySchema = z.object({
    text: z.string().trim().min(1).max(10000),
    context: z.string().trim().min(1).max(200).optional().default('geri bildirim')
}).strict();

const employeeFeedbackBodySchema = z.object({
    type: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(255),
    content: z.string().trim().min(1).max(10000),
    is_anonymous: z.boolean().optional().default(false)
}).strict();

const suggestionDetailsSchema = z.object({
    department: optionalText(255),
    currentSituation: optionalText(5000),
    proposedSituation: optionalText(5000),
    category: optionalText(255),
    investment: optionalText(2000),
    estimatedCost: optionalText(255)
}).strict();

const suggestionDetailsJsonSchema = z.string().max(20000).superRefine((value, context) => {
    try {
        const parsed = JSON.parse(value);
        const result = suggestionDetailsSchema.safeParse(parsed);
        if (!result.success) {
            context.addIssue({
                code: 'custom',
                message: 'Öneri ayrıntıları geçerli değil.'
            });
        }
    } catch {
        context.addIssue({
            code: 'custom',
            message: 'Öneri ayrıntıları geçerli JSON olmalıdır.'
        });
    }
});

const suggestionBodySchema = z.object({
    type: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(255),
    content: z.string().trim().min(1).max(10000),
    is_anonymous: multipartBoolean,
    details: suggestionDetailsJsonSchema
}).strict();

const commentBodySchema = z.object({
    comment: z.string().trim().min(1).max(5000),
    is_public: z.boolean().optional().default(false)
}).strict();
const multipartCommentBodySchema = commentBodySchema.extend({ is_public: multipartBoolean });

const assignmentBodySchema = z.object({
    assigned_to_user_id: z.union([z.null(), positiveId]).optional().default(null),
    assigned_department: nullableText(255),
    participant_user_ids: z.array(positiveId).max(500).optional().default([]),
    replace_participants: z.boolean().optional().default(false),
    due_date: z.union([
        z.null(),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    ]).optional().default(null),
    note: optionalText(2000)
}).strict();

const participantsBodySchema = z.object({
    user_ids: z.array(positiveId).max(500)
}).strict();

const decisionBodySchema = z.object({
    status: z.enum(['resolved', 'rejected']).optional(),
    decision: z.enum(['', ...DECISIONS]).optional().default(''),
    decision_note: optionalText(5000),
    public_response: optionalText(5000)
}).strict();

const statusBodySchema = z.object({
    status: z.enum(feedbackStatuses)
}).strict();
const feedbackListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional(),
    status: z.string().trim().max(50).optional(),
    type: z.string().trim().max(50).optional(),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    sort: z.enum(['created_at', 'status', 'type', 'due_date']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();
const optionListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional()
}).strict();

module.exports = {
    assignmentBodySchema,
    commentAttachmentParamsSchema,
    commentBodySchema,
    decisionBodySchema,
    employeeFeedbackBodySchema,
    feedbackListQuerySchema,
    idParamsSchema,
    improveTextBodySchema,
    multipartCommentBodySchema,
    optionListQuerySchema,
    participantsBodySchema,
    statusBodySchema,
    suggestionBodySchema
};
