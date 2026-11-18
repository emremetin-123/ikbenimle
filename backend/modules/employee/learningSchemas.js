const { z } = require('zod');

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const boundedSeconds = z.number().finite().min(0).max(31_536_000);
const boundedPage = z.number().int().min(0).max(1_000_000);

const lessonWatchBodySchema = z.object({
    progress_token: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    watched_seconds: boundedSeconds.optional().default(0),
    active_seconds: boundedSeconds.optional(),
    last_position: boundedSeconds.optional().default(0),
    max_position: boundedSeconds.optional().default(0),
    duration_seconds: boundedSeconds.optional().default(0),
    video_completed: z.boolean().optional().default(false),
    page_number: boundedPage.optional().default(0),
    page_count: boundedPage.optional().default(0),
    content_progress_percent: z.number().finite().min(0).max(100).optional().default(0),
    content_completed: z.boolean().optional().default(false),
    is_playing: z.boolean().optional().default(true)
}).strict();

const quizAnswerSchema = z.union([
    z.number().int().min(0).max(1_000),
    z.string().trim().regex(/^\d{1,4}$/)
]);

const lessonQuizBodySchema = z.object({
    answers: z.record(z.string().regex(/^\d{1,4}$/), quizAnswerSchema)
}).strict();

module.exports = {
    idParamsSchema,
    lessonQuizBodySchema,
    lessonWatchBodySchema
};
