const { z } = require('zod');

const idParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const multipartBooleanSchema = z.union([
    z.boolean(),
    z.literal(0),
    z.literal(1),
    z.literal('0'),
    z.literal('1'),
    z.literal('true'),
    z.literal('false')
]);

const optionalMultipartNumber = (schema) => z.preprocess(
    (value) => value === '' || value === null || value === undefined ? undefined : value,
    z.coerce.number().pipe(schema).optional()
);

const quizQuestionSchema = z.object({
    text: z.string().trim().min(1).max(1_000),
    options: z.array(z.string().trim().min(1).max(1_000)).min(2).max(10),
    correct: z.number().int().min(0).max(9)
}).strict().refine(
    (question) => question.correct < question.options.length,
    { message: 'Doğru cevap seçeneği mevcut seçeneklerden biri olmalıdır.', path: ['correct'] }
);

const lessonSchema = z.object({
    title: z.string().trim().min(1).max(255),
    url: z.string().trim().max(2_048).optional().default(''),
    description: z.string().trim().max(10_000).optional().default(''),
    content_type: z.enum(['video', 'pdf']).default('video'),
    content_metadata: z.record(
        z.string().max(100),
        z.union([z.string().max(2_000), z.number().finite(), z.boolean(), z.null()])
    ).optional().default({}),
    required_seconds: z.coerce.number().finite().min(0).max(31_536_000).optional().default(0),
    required_percent: z.coerce.number().finite().min(0).max(100).optional().default(0),
    file_name: z.string().trim().max(255).optional(),
    quizData: z.object({
        questions: z.array(quizQuestionSchema).min(1).max(200)
    }).strict().nullable().optional().default(null)
}).strict();

const lessonsSchema = z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}, z.array(lessonSchema).min(1).max(200));

const modulesSchema = z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
}, z.array(z.object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(10_000).optional().default(''),
    contents: z.array(lessonSchema.omit({ quizData: true })).min(1).max(200),
    quizData: lessonSchema.shape.quizData
}).strict()).min(1).max(200));

const trainingBodyShape = {
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(20_000).optional().default(''),
    category: z.string().trim().max(255).optional().default(''),
    pass_score: optionalMultipartNumber(z.number().finite().min(0).max(100)),
    trainer_name: z.string().trim().max(255).optional().default(''),
    trainer_title: z.string().trim().max(255).optional().default(''),
    duration: z.string().trim().max(100).optional().default(''),
    validity_period: z.string().trim().max(100).optional().default(''),
    awards_badge: multipartBooleanSchema.optional(),
    certificate_enabled: multipartBooleanSchema.optional(),
    auto_reassign_enabled: multipartBooleanSchema.optional(),
    validity_amount: optionalMultipartNumber(z.number().int().min(1).max(10_000)),
    validity_unit: z.enum(['day', 'month', 'year']).optional(),
    pause_on_blur: multipartBooleanSchema.optional(),
    disable_forward_seek: multipartBooleanSchema.optional(),
    track_watch_seconds: multipartBooleanSchema.optional(),
    quiz_attempt_limit: optionalMultipartNumber(z.number().int().min(0).max(100)),
    training_profile: z.enum(['free', 'standard', 'supervised', 'compliance']).optional(),
    delivery_method: z.enum(['online']).optional(),
    is_mandatory: multipartBooleanSchema.optional(),
    compliance_lock: multipartBooleanSchema.optional(),
    minimum_watch_percent: optionalMultipartNumber(z.number().finite().min(0).max(100)),
    requires_full_watch: multipartBooleanSchema.optional(),
    requires_quiz: multipartBooleanSchema.optional(),
    official_documents_enabled: multipartBooleanSchema.optional(),
    detailed_audit_enabled: multipartBooleanSchema.optional(),
    remove_cover_image: multipartBooleanSchema.optional(),
    cover_image_url: z.string().trim().max(2_048).optional().default(''),
    remove_badge_image: multipartBooleanSchema.optional(),
    badge_image_url: z.string().trim().max(2_048).optional().default(''),
    lessons: lessonsSchema.optional(),
    modules: modulesSchema.optional()
};

const isEnabled = value => value === true || value === 1 || value === '1' || value === 'true';
const requireTrustedVideoDuration = (body, context) => {
    const profile = body.training_profile || 'standard';
    const requiresFullWatch = profile === 'compliance'
        || (body.requires_full_watch === undefined ? profile !== 'free' : isEnabled(body.requires_full_watch));
    if (!requiresFullWatch) return;
    const contents = body.modules ? body.modules.flatMap(module => module.contents) : body.lessons || [];
    contents.forEach((lesson, index) => {
        if (lesson.content_type === 'video' && Number(lesson.required_seconds || 0) <= 0) {
            context.addIssue({
                code: 'custom',
                path: ['lessons', index, 'required_seconds'],
                message: 'Tam izleme gereken videolarda güvenilir süre zorunludur.'
            });
        }
    });
};

const validateTrainingContent = (body, context) => {
    if (Boolean(body.lessons) === Boolean(body.modules)) {
        context.addIssue({ code: 'custom', path: ['modules'], message: 'Modül veya eski ders listesi gönderilmelidir.' });
        return;
    }
    if (body.modules && body.modules.reduce((count, module) => count + module.contents.length, 0) > 200) {
        context.addIssue({ code: 'custom', path: ['modules'], message: 'Eğitim en fazla 200 içerik barındırabilir.' });
    }
    if (body.modules && (body.training_profile === 'compliance' || isEnabled(body.requires_quiz))) {
        body.modules.forEach((module, index) => {
            if (!module.quizData?.questions?.length) {
                context.addIssue({ code: 'custom', path: ['modules', index, 'quizData'], message: 'İSG/Kanuni Uyum modülünde sınav zorunludur.' });
            }
        });
    }
    requireTrustedVideoDuration(body, context);
};

const trainingCreateBodySchema = z.object(trainingBodyShape).strict().superRefine(validateTrainingContent);
const trainingUpdateBodySchema = z.object(trainingBodyShape).strict().superRefine(validateTrainingContent);

const trainingAssignmentBodySchema = z.object({
    user_ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    video_id: z.coerce.number().int().positive(),
    due_date: z.iso.date().nullable().optional()
}).strict();

module.exports = {
    idParamsSchema,
    trainingAssignmentBodySchema,
    trainingCreateBodySchema,
    trainingUpdateBodySchema
};
