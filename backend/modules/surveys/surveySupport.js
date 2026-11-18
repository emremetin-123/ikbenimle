const { z } = require('zod');

const surveyIdParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const employeeSurveyListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(255).optional(),
    sort: z.enum(['created_at', 'title']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();

const adminSurveyListQuerySchema = employeeSurveyListQuerySchema.extend({
    status: z.enum(['draft', 'active', 'closed']).optional()
}).strict();

const surveyResultsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(255).optional(),
    sort: z.enum(['submitted_at', 'name']).default('submitted_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();

const surveyAnswerSchema = z.object({
    question_id: z.coerce.number().int().positive(),
    value: z.union([
        z.string().max(5000),
        z.array(z.string().max(500)).max(100)
    ])
}).strict();

const surveyResponseBodySchema = z.object({
    answers: z.array(surveyAnswerSchema).max(200)
}).strict();

const surveyQuestionBodySchema = z.object({
    question_text: z.string().trim().min(1).max(2000),
    question_type: z.enum(['single_choice', 'multiple_choice', 'text', 'rating']),
    options: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
    is_required: z.boolean().default(false),
    order_index: z.coerce.number().int().min(0).optional()
}).strict();

const createSurveyBodySchema = z.object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).optional().default(''),
    status: z.enum(['draft', 'active', 'closed']).default('draft'),
    questions: z.array(surveyQuestionBodySchema).min(1).max(200)
}).strict();

const updateSurveyStatusBodySchema = z.object({
    status: z.enum(['draft', 'active', 'closed'])
}).strict();

const parseOptions = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const normalizeQuestion = (question, index) => ({
    id: question.id,
    survey_id: question.survey_id,
    question_text: question.question_text,
    question_type: question.question_type,
    options: parseOptions(question.options),
    is_required: Boolean(question.is_required),
    order_index: question.order_index ?? index,
});

const normalizeAnswerValue = (value) => {
    if (Array.isArray(value)) return JSON.stringify(value);
    if (value === null || value === undefined) return '';
    return String(value);
};

const csvEscape = (value) => {
    const text = String(value ?? '');
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const formatTurkeyDateTime = (value) => {
    if (!value) return '';
    const text = String(value);
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
        ? `${text.replace(' ', 'T')}Z`
        : text;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const formatExportAnswer = (value, questionType) => {
    const parsed = parseAnswerValue(value, questionType);
    return Array.isArray(parsed) ? parsed.join(', ') : parsed;
};

const parseAnswerValue = (value, questionType) => {
    if (questionType === 'multiple_choice') return parseOptions(value);
    return value || '';
};


module.exports = {
    surveyIdParamsSchema,
    employeeSurveyListQuerySchema,
    adminSurveyListQuerySchema,
    surveyResultsQuerySchema,
    surveyResponseBodySchema,
    createSurveyBodySchema,
    updateSurveyStatusBodySchema,
    normalizeQuestion,
    normalizeAnswerValue,
    csvEscape,
    formatTurkeyDateTime,
    formatExportAnswer,
    parseAnswerValue
};
