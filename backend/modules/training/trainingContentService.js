const { createTrainingRepository } = require('./trainingRepository');
const { storeTrainingContent } = require('./trainingUploadService');

const toBoolInt = (value, defaultValue = false) => {
    if (value === undefined || value === null || value === '') return defaultValue ? 1 : 0;
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
};

const toPercent = (value, fallback = 100) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(100, Math.max(0, Math.round(parsed)));
};

const normalizeTrainingProfile = profile => {
    const allowed = ['free', 'standard', 'supervised', 'compliance'];
    return allowed.includes(profile) ? profile : 'standard';
};

const buildTrainingSettings = body => {
    const trainingProfile = normalizeTrainingProfile(
        body.training_profile || body.trainingProfile
    );
    const complianceLock = trainingProfile === 'compliance'
        ? 1
        : toBoolInt(body.compliance_lock, false);
    const requiresQuiz = toBoolInt(
        body.requires_quiz,
        trainingProfile === 'supervised' || trainingProfile === 'compliance'
    );
    const requiresFullWatch = toBoolInt(
        body.requires_full_watch,
        trainingProfile !== 'free'
    );
    const detailedAudit = toBoolInt(
        body.detailed_audit_enabled,
        trainingProfile === 'compliance' || trainingProfile === 'supervised'
    );

    return {
        training_profile: trainingProfile,
        delivery_method: body.delivery_method || 'online',
        is_mandatory: toBoolInt(body.is_mandatory, trainingProfile !== 'free'),
        compliance_lock: complianceLock,
        minimum_watch_percent: complianceLock
            ? Math.max(100, toPercent(body.minimum_watch_percent, 100))
            : toPercent(body.minimum_watch_percent, requiresFullWatch ? 100 : 0),
        requires_full_watch: complianceLock ? 1 : requiresFullWatch,
        requires_quiz: complianceLock ? 1 : requiresQuiz,
        official_documents_enabled: toBoolInt(
            body.official_documents_enabled,
            trainingProfile === 'compliance'
        ),
        detailed_audit_enabled: detailedAudit,
        cover_image_url: body.cover_image_url || ''
    };
};

const TRAINING_CONTENT_TYPES = ['video', 'pdf'];

const normalizeContentType = value => {
    const normalized = String(value || 'video').toLowerCase();
    return TRAINING_CONTENT_TYPES.includes(normalized) ? normalized : 'video';
};

const safeJson = (value, fallback = null) => {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const parseLessonsPayload = lessonsJson => {
    try {
        const lessons = typeof lessonsJson === 'string'
            ? JSON.parse(lessonsJson || '[]')
            : lessonsJson;
        return Array.isArray(lessons) ? lessons : [];
    } catch {
        return null;
    }
};

const parseTrainingContents = body => {
    if (!body.modules) return parseLessonsPayload(body.lessons);
    const modules = typeof body.modules === 'string'
        ? safeJson(body.modules, null)
        : body.modules;
    if (!Array.isArray(modules)) return null;
    return modules.flatMap((module, moduleIndex) => module.contents.map(
        (content, contentIndex) => ({
            ...content,
            module_title: module.title,
            module_description: module.description || '',
            module_index: moduleIndex,
            quizData: contentIndex === module.contents.length - 1
                ? module.quizData || null
                : null
        })
    ));
};

const validateLessonsPayload = (lessons, files = []) => {
    if (!Array.isArray(lessons) || lessons.length === 0) {
        return 'En az bir egitim modulu eklenmelidir';
    }
    const fileFieldnames = new Set((files || []).map(file => file.fieldname));
    for (let index = 0; index < lessons.length; index += 1) {
        const lesson = lessons[index];
        if (!lesson.title?.trim()) return 'Modul basligi zorunludur';
        const type = normalizeContentType(lesson.content_type);
        const file = (files || []).find(item => item.fieldname === `lesson_${index}_file`);
        if (file && type === 'video' && !file.mimetype?.startsWith('video/')) {
            return 'Video modulleri icin video dosyasi yuklenmelidir';
        }
        if (
            file
            && type === 'pdf'
            && file.mimetype !== 'application/pdf'
            && !file.originalname?.toLowerCase().endsWith('.pdf')
        ) {
            return 'PDF/Sunum icerikleri PDF dosyasi olarak yuklenmelidir';
        }
        if (
            type === 'pdf'
            && lesson.file_name
            && !String(lesson.file_name).toLowerCase().endsWith('.pdf')
        ) {
            return 'PDF/Sunum icerikleri PDF dosyasi olarak yuklenmelidir';
        }
        if (!fileFieldnames.has(`lesson_${index}_file`) && !lesson.url?.trim()) {
            return 'Her modul icin dosya veya icerik URL bilgisi gerekir';
        }
    }
    return null;
};

const buildLessonMetadata = (lesson = {}) => ({
    contentType: normalizeContentType(lesson.content_type),
    contentMetadata: JSON.stringify(lesson.content_metadata || {}),
    requiredSeconds: Math.max(0, Math.round(Number(lesson.required_seconds || 0))),
    requiredPercent: toPercent(
        lesson.required_percent,
        normalizeContentType(lesson.content_type) === 'video' ? 100 : 80
    )
});

const insertTrainingLessons = async (db, videoId, lessons, files, uploadedFiles) => {
    const repository = createTrainingRepository(db);
    let moduleId = null;
    let moduleIndex = -1;
    for (let index = 0; index < lessons.length; index += 1) {
        const lesson = lessons[index];
        const nextModuleIndex = lesson.module_index ?? index;
        if (nextModuleIndex !== moduleIndex) {
            const moduleResult = await repository.createModule(videoId, {
                title: lesson.module_title || lesson.title,
                description: lesson.module_description || '',
                orderIndex: nextModuleIndex
            });
            moduleId = moduleResult.lastID;
            moduleIndex = nextModuleIndex;
        }
        const file = (files || []).find(item => item.fieldname === `lesson_${index}_file`);
        const contentUrl = file
            ? await storeTrainingContent(file, uploadedFiles)
            : lesson.url || '';
        const metadata = buildLessonMetadata(lesson);
        const lessonResult = await repository.createLesson(videoId, moduleId, {
            title: lesson.title,
            url: contentUrl,
            description: lesson.description || '',
            ...metadata,
            orderIndex: index
        });
        if (lesson.quizData) {
            await repository.createQuiz(
                videoId,
                lessonResult.lastID,
                JSON.stringify(lesson.quizData)
            );
        }
    }
};

module.exports = {
    buildTrainingSettings,
    normalizeContentType,
    safeJson,
    parseLessonsPayload,
    parseTrainingContents,
    validateLessonsPayload,
    insertTrainingLessons
};
