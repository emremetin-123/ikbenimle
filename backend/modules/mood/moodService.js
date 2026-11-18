const { AppError } = require('../../core/http');
const { paginatedResponse } = require('../../core/pagination');
const { generateGeminiText } = require('../../services/geminiTextService');
const {
    MIN_ANONYMOUS_COHORT,
    getTodayIso,
    moodGroupsToCsv
} = require('../../services/moodPrivacyService');
const { MOODS, MOOD_REASONS } = require('./moodSchemas');

function createMoodService(db, repository) {
    return {
        async getToday(userId, submittedDate) {
            const today = getTodayIso();
            const callback = await repository.callbackExists(userId, today);
            return {
                submitted: submittedDate === today,
                callback_requested: Boolean(callback)
            };
        },
        async submit(userId, body, submittedDate) {
            const today = getTodayIso();
            if (submittedDate === today) {
                throw new AppError(
                    409,
                    'MOOD_ALREADY_SUBMITTED',
                    'Bugünkü duygu yanıtınız bu cihazdan daha önce gönderildi.'
                );
            }
            const mood = MOODS[body.mood_id];
            const profile = await repository.findDepartment(userId);
            await repository.insertMood({
                date: today,
                moodId: body.mood_id,
                moodLabel: mood.label,
                moodScore: mood.score,
                reasonKey: body.reason_key,
                reasonLabel: body.reason_key ? MOOD_REASONS[body.reason_key] : null,
                department: profile?.department || null
            });
            return today;
        },
        async requestCallback(userId, submittedDate) {
            const today = getTodayIso();
            if (submittedDate !== today) {
                throw new AppError(
                    409,
                    'MOOD_RESPONSE_REQUIRED',
                    'Geri aranma talebinden önce günlük yanıtınızı gönderin.'
                );
            }
            if (!await repository.callbackExists(userId, today)) {
                await repository.createCallback(userId, today);
            }
        },
        async getReport(input, pagination) {
            const [summary, items, total, departments] = await Promise.all([
                repository.summarize(input),
                repository.readRows(input, pagination),
                repository.countGroups(input),
                repository.listDepartments()
            ]);
            return {
                ...paginatedResponse(items, total, pagination.page, pagination.pageSize),
                summary,
                departments
            };
        },
        async getCallbacks(input, pagination) {
            const result = await repository.readCallbacks(input, pagination);
            return paginatedResponse(
                result.items,
                result.total,
                pagination.page,
                pagination.pageSize
            );
        },
        async exportReport(input) {
            return moodGroupsToCsv(await repository.readRows(input));
        },
        async analyze(input) {
            const [summary, groupedRows] = await Promise.all([
                repository.summarize(input),
                repository.readRows(input)
            ]);
            const prompt = [
                'Aşağıdaki anonim ve toplulaştırılmış çalışan duygu durumu verilerini İK perspektifiyle analiz et.',
                `En az ${MIN_ANONYMOUS_COHORT} yanıt içermeyen departman-gün kohortları veri setinden çıkarılmıştır.`,
                'Kişisel teşhis koyma, tıbbi yorum yapma ve tekil çalışan hedefleme.',
                'Yalnız departman ve sebep kırılımlarını yorumla.',
                'Türkçe yanıt ver. Başlıklar: Genel Özet, Departman Sinyalleri, Sebep Kırılımı, Riskler, Önerilen Aksiyonlar.',
                '',
                JSON.stringify({ summary, grouped_rows: groupedRows })
            ].join('\n');
            return generateGeminiText(db, prompt);
        }
    };
}

module.exports = { createMoodService };
