const { z } = require('zod');
const { createEmployeeLearningRepository } = require('./employeeLearningRepository');

const employeeTrainingListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    status: z.enum(['all', 'pending', 'completed']).default('all'),
    badge: z.enum(['all', 'awarded']).default('all'),
    search: z.string().trim().max(255).optional(),
    sort: z.enum(['assigned_at', 'completed_at', 'due_date', 'title']).default('assigned_at'),
    order: z.enum(['asc', 'desc']).default('desc')
}).strict();

const isEnabled = (value) => value === true || value === 1 || value === '1';

const escapeHtml = (value) => String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatVerifyDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('tr-TR');
};

const wantsJson = (req) => req.query.format === 'json' || String(req.get('accept') || '').includes('application/json');

const renderCertificateVerifyPage = (certificate) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sertifika Dogrulama</title>
  <style>
    :root { color-scheme: light; font-family: Inter, Arial, sans-serif; background: #f4f7fb; color: #172033; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: min(680px, 100%); background: #fff; border: 1px solid #dbe4f0; border-radius: 18px; box-shadow: 0 24px 80px rgba(15, 47, 95, .14); overflow: hidden; }
    .head { background: linear-gradient(135deg, #0f2f5f, #2563eb); color: #fff; padding: 26px; }
    .head small { opacity: .82; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
    .head h1 { margin: 8px 0 0; font-size: clamp(1.5rem, 5vw, 2.1rem); }
    .body { padding: 26px; display: grid; gap: 16px; }
    .ok { display: inline-flex; align-items: center; gap: 10px; width: fit-content; padding: 10px 14px; border-radius: 999px; background: #dcfce7; color: #166534; font-weight: 800; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .item { padding: 14px; border: 1px solid #e6edf6; border-radius: 12px; background: #f8fafc; }
    .label { color: #64748b; font-size: .76rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 800; margin-bottom: 6px; }
    .value { color: #172033; font-weight: 750; overflow-wrap: anywhere; }
    .ref { border-color: #bfdbfe; background: #eff6ff; }
    .foot { padding: 18px 26px; border-top: 1px solid #e6edf6; color: #64748b; font-size: .86rem; }
    @media (max-width: 560px) { body { padding: 14px; } .grid { grid-template-columns: 1fr; } .head, .body, .foot { padding: 20px; } }
  </style>
</head>
<body>
  <main class="card">
    <section class="head">
      <small>IKBenimle Akademi</small>
      <h1>Sertifika Dogrulama</h1>
    </section>
    <section class="body">
      <div class="ok">✓ Belge sistemde dogrulandi</div>
      <div class="grid">
        <div class="item"><div class="label">Calisan</div><div class="value">${escapeHtml(certificate.name)}</div></div>
        <div class="item"><div class="label">Egitim</div><div class="value">${escapeHtml(certificate.title)}</div></div>
        <div class="item"><div class="label">Tamamlama</div><div class="value">${escapeHtml(formatVerifyDate(certificate.completed_at))}</div></div>
        <div class="item"><div class="label">Onay</div><div class="value">${escapeHtml(formatVerifyDate(certificate.confirmed_at))}</div></div>
        <div class="item"><div class="label">Versiyon</div><div class="value">${certificate.version_no ? `v${escapeHtml(certificate.version_no)}` : '-'}</div></div>
        <div class="item ref" style="grid-column: 1 / -1;"><div class="label">Belge Referans No</div><div class="value">${escapeHtml(certificate.reference_id)}</div></div>
      </div>
    </section>
    <section class="foot">Bu sayfa, QR kod ile acilan resmi dijital dogrulama ekranidir.</section>
  </main>
</body>
</html>`;

const parseQuiz = (quizData) => {
    if (!quizData) return null;
    try {
        const parsed = typeof quizData === 'string' ? JSON.parse(quizData) : quizData;
        return parsed?.questions?.length ? parsed : null;
    } catch {
        return null;
    }
};

const sanitizeQuiz = (quizData) => {
    const parsed = parseQuiz(quizData);
    if (!parsed) return null;
    return {
        questions: parsed.questions.map((question) => ({
            text: question.text,
            options: Array.isArray(question.options) ? question.options : []
        }))
    };
};

const calculateQuizScore = (quizData, answers = {}) => {
    const quiz = parseQuiz(quizData);
    if (!quiz) return { score: 100, total: 0, correct: 0 };
    let correct = 0;
    quiz.questions.forEach((question, index) => {
        if (Number(answers[index]) === Number(question.correct)) correct++;
    });
    return {
        score: Math.round((correct / quiz.questions.length) * 100),
        total: quiz.questions.length,
        correct
    };
};

const logTrainingEvent = async (db, { assignment_id, user_id, video_id, lesson_id, event_type, event_data = {}, req = null }) => {
    try {
        await createEmployeeLearningRepository(db).logEvent([
            assignment_id || null,
            user_id || null,
            video_id || null,
            lesson_id || null,
            event_type,
            JSON.stringify(event_data),
            event_data.session_id || null,
            req?.ip || null,
            req?.get?.('user-agent') || null
        ]);
    } catch (err) {
        console.error('Training activity log error:', err.message);
    }
};

const refreshAssignmentCompletion = async (db, assignmentId, videoId) => {
    const repository = createEmployeeLearningRepository(db);
    const allLessons = await repository.listLessonIds(videoId);
    const completedLessons = await repository.listCompletedLessons(assignmentId);
    if (allLessons.length === 0 || completedLessons.length !== allLessons.length) return false;

    const scoredLessons = completedLessons.filter((lesson) => lesson.score !== null && lesson.score !== undefined);
    const avgScore = scoredLessons.length
        ? Math.round(scoredLessons.reduce((sum, lesson) => sum + Number(lesson.score || 0), 0) / scoredLessons.length)
        : 100;

    await repository.completeAssignment(assignmentId, avgScore);
    return true;
};

const loadCertificateEvidence = async (db, assignmentId, userId = null) => {
    const repository = createEmployeeLearningRepository(db);
    const assignment = await repository.findCertificateEvidence(assignmentId, userId);
    if (!assignment) return null;
    const lessons = await repository.listCertificateLessons(
        assignment.id,
        assignment.video_id
    );
    return { assignment, lessons };
};


module.exports = {
    employeeTrainingListQuerySchema,
    isEnabled,
    wantsJson,
    renderCertificateVerifyPage,
    parseQuiz,
    sanitizeQuiz,
    calculateQuizScore,
    logTrainingEvent,
    refreshAssignmentCompletion,
    loadCertificateEvidence
};
