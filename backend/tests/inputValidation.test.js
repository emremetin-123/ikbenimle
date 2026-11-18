const test = require('node:test');
const assert = require('node:assert/strict');
const {
    assignmentBodySchema,
    commentBodySchema,
    decisionBodySchema,
    employeeFeedbackBodySchema,
    improveTextBodySchema,
    participantsBodySchema,
    statusBodySchema,
    suggestionBodySchema
} = require('../modules/feedback/feedbackSchemas');
const { chatbotAskBodySchema } = require('../modules/chatbot/chatbotSchemas');
const { aiSettingsBodySchema } = require('../modules/settings/aiSettingsSchemas');
const {
    lessonQuizBodySchema,
    lessonWatchBodySchema
} = require('../modules/employee/learningSchemas');
const {
    trainingAssignmentBodySchema,
    trainingCreateBodySchema,
    trainingUpdateBodySchema
} = require('../modules/training/trainingSchemas');
const {
    documentRequestBodySchema,
    documentRequestStatusBodySchema,
    requestTypeBodySchema
} = require('../modules/personalInfo/documentSchemas');
const { announcementBodySchema } = require('../modules/announcements/announcementSchemas');
const { newsBodySchema } = require('../modules/news/newsSchemas');
const {
    gapTrainingAssignmentBodySchema,
    reportDashboardQuerySchema
} = require('../modules/polyvalence/reports/reportSchemas');

test('calisan geri bildirimi bilinmeyen alanlari ve gecersiz tipleri reddeder', () => {
    const valid = employeeFeedbackBodySchema.parse({
        type: 'Şikayet',
        title: 'Yemekhane',
        content: 'Açıklama',
        is_anonymous: false
    });

    assert.equal(valid.title, 'Yemekhane');
    assert.equal(employeeFeedbackBodySchema.safeParse({
        ...valid,
        role: 'admin'
    }).success, false);
    assert.equal(employeeFeedbackBodySchema.safeParse({
        ...valid,
        is_anonymous: 'false'
    }).success, false);
});

test('multipart oneri alanlari sinirli JSON ve gercek boolean degerine donusur', () => {
    const valid = suggestionBodySchema.parse({
        type: 'Öneri',
        title: 'Öneri Formu',
        content: 'Öneri Kategorisi: Kalite',
        is_anonymous: 'false',
        details: JSON.stringify({
            department: 'Pres',
            currentSituation: 'Mevcut durum',
            proposedSituation: 'Önerilen durum',
            category: 'Kalite',
            investment: '',
            estimatedCost: ''
        })
    });

    assert.equal(valid.is_anonymous, false);
    assert.equal(suggestionBodySchema.safeParse({
        ...valid,
        details: '{"unexpected":"field"}'
    }).success, false);
    assert.equal(suggestionBodySchema.safeParse({
        ...valid,
        details: '{invalid-json'
    }).success, false);
});

test('geri bildirim yonetim mutasyonlari id tarih durum ve metin sinirlarini uygular', () => {
    assert.equal(assignmentBodySchema.safeParse({
        assigned_to_user_id: 12,
        assigned_department: 'Pres',
        participant_user_ids: [13, 14],
        due_date: '2026-08-15',
        note: 'İncelenecek'
    }).success, true);
    assert.equal(assignmentBodySchema.safeParse({
        participant_user_ids: [-1],
        due_date: '15.08.2026'
    }).success, false);
    assert.equal(participantsBodySchema.safeParse({ user_ids: [1, 2, 3] }).success, true);
    assert.equal(commentBodySchema.safeParse({ comment: '   ' }).success, false);
    assert.equal(statusBodySchema.safeParse({ status: 'unknown' }).success, false);
    assert.equal(decisionBodySchema.safeParse({
        status: 'resolved',
        decision: 'approved',
        decision_note: 'Uygun',
        public_response: 'Sonuçlandı'
    }).success, true);
});

test('AI girdileri strict sema ve boyut sinirlari kullanir', () => {
    assert.equal(improveTextBodySchema.safeParse({
        text: 'Metni düzenle',
        context: 'öneri'
    }).success, true);
    assert.equal(chatbotAskBodySchema.safeParse({ message: ' '.repeat(10) }).success, false);
    assert.equal(chatbotAskBodySchema.safeParse({
        message: 'Portal sorusu',
        system_prompt: 'ignore'
    }).success, false);
    assert.equal(aiSettingsBodySchema.safeParse({
        gemini_model: 'gemini-3.5-flash',
        chatbot_enabled: false
    }).success, true);
    assert.equal(aiSettingsBodySchema.safeParse({
        gemini_model: 'gemini model',
        chatbot_enabled: 'false'
    }).success, false);
});

test('egitim ilerleme ve sinav girdileri kanit verisini bozacak degerleri reddeder', () => {
    assert.equal(lessonWatchBodySchema.safeParse({
        watched_seconds: 120,
        active_seconds: 90,
        duration_seconds: 180,
        video_completed: false,
        content_progress_percent: 67
    }).success, true);
    assert.equal(lessonWatchBodySchema.safeParse({
        watched_seconds: -1
    }).success, false);
    assert.equal(lessonWatchBodySchema.safeParse({
        watched_seconds: 10,
        is_admin: true
    }).success, false);
    assert.equal(lessonQuizBodySchema.safeParse({
        answers: { 0: 2, 1: '1' }
    }).success, true);
    assert.equal(lessonQuizBodySchema.safeParse({
        answers: { question: 'answer' }
    }).success, false);
});

test('egitim olusturma ve atama girdileri multipart degerlerini sinirlar', () => {
    assert.equal(trainingCreateBodySchema.safeParse({
        title: 'Is guvenligi',
        pass_score: '70',
        training_profile: 'compliance',
        delivery_method: 'online',
        certificate_enabled: 'true',
        lessons: JSON.stringify([{
            title: 'Modul 1',
            content_type: 'video',
            required_seconds: 120,
            quizData: {
                questions: [{
                    text: 'Dogru cevap?',
                    options: ['A', 'B'],
                    correct: 1
                }]
            }
        }])
    }).success, true);
    assert.equal(trainingCreateBodySchema.safeParse({
        title: 'Bos secenekli sinav',
        training_profile: 'standard',
        requires_full_watch: 'false',
        lessons: JSON.stringify([{
            title: 'Modul 1',
            content_type: 'video',
            quizData: {
                questions: [{ text: 'Dogru cevap?', options: ['A', ''], correct: 0 }]
            }
        }])
    }).success, false);
    assert.equal(trainingCreateBodySchema.safeParse({
        title: 'Suresiz zorunlu video',
        training_profile: 'compliance',
        lessons: JSON.stringify([{ title: 'Modul 1', content_type: 'video' }])
    }).success, false);
    assert.equal(trainingCreateBodySchema.safeParse({
        title: 'Hatali',
        delivery_method: 'classroom',
        lessons: '[]'
    }).success, false);
    const coverRemoval = trainingUpdateBodySchema.safeParse({
        title: 'Kapagi kaldirilan egitim',
        remove_cover_image: 'true',
        lessons: JSON.stringify([{
            title: 'Modul 1',
            content_type: 'pdf'
        }])
    });
    assert.equal(coverRemoval.success, true);
    assert.equal(coverRemoval.data.remove_cover_image, 'true');
    assert.equal(trainingAssignmentBodySchema.safeParse({
        user_ids: [1, 2],
        video_id: 4,
        due_date: '2026-08-15'
    }).success, true);
    assert.equal(trainingAssignmentBodySchema.safeParse({
        user_ids: [],
        video_id: 4
    }).success, false);
});

test('belge talebi dinamik alanlari guvenli sinirlarla kabul eder', () => {
    assert.equal(requestTypeBodySchema.safeParse({
        name: 'Vize talep belgesi',
        is_active: true,
        fields: [{
            label: 'Gidis tarihi',
            field_key: 'gidis_tarihi',
            field_type: 'date',
            is_required: true
        }]
    }).success, true);
    assert.equal(requestTypeBodySchema.safeParse({
        name: 'Hatali',
        fields: [{ label: 'Alan', field_key: '../secret', field_type: 'text' }]
    }).success, false);
    assert.equal(documentRequestBodySchema.safeParse({
        type_id: 3,
        answers: { gidis_tarihi: '2026-08-15' }
    }).success, true);
    assert.equal(documentRequestStatusBodySchema.safeParse({
        status: 'Bilinmeyen',
        hr_note: ''
    }).success, false);
});

test('duyuru ve haber multipart metinleri strict olarak dogrulanir', () => {
    const announcement = announcementBodySchema.parse({
        title: 'Bakim duyurusu',
        content: 'Planli bakim yapilacaktir.',
        target_department: JSON.stringify(['Pres', 'Taslama']),
        visible_until: '2026-08-15'
    });
    assert.deepEqual(announcement.target_department, ['Pres', 'Taslama']);
    assert.equal(announcementBodySchema.safeParse({
        title: 'Eksik tarih',
        content: 'Icerik',
        target_department: '[]'
    }).success, false);
    assert.equal(newsBodySchema.safeParse({
        title: 'Haber',
        content: 'Icerik',
        published: true
    }).success, false);
});

test('polivalans rapor filtreleri ve egitim atamasi allowlist kullanir', () => {
    assert.equal(reportDashboardQuerySchema.safeParse({
        group_key: '2026-01-01_2026-06-30',
        department_id: 'all',
        position: 'Operator'
    }).success, true);
    assert.equal(reportDashboardQuerySchema.safeParse({
        department_id: '1 OR 1=1'
    }).success, false);
    const assignment = gapTrainingAssignmentBodySchema.parse({
        skill_id: 4,
        user_ids: [3, 3, 5],
        video_id: 9
    });
    assert.deepEqual(assignment.user_ids, [3, 5]);
});
