const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');
const {
    getTodayIso,
    getNextMonthStart,
    splitItems,
    mapRow,
    parseMealMenuPdf
} = require('./menuParser');
const { normalizeRatingRow } = require('./mealRatingRepository');
const { csvEscape, formatTurkeyDateTime } = require('./mealReportFormatters');

function createMealMenuService(repository, { parseWithAi }) {
    const monthRange = month => [`${month}-01`, getNextMonthStart(month)];
    return {
        async getMenu(date = getTodayIso()) {
            const row = await repository.findMenu(date);
            return row ? mapRow(row) : null;
        },
        async getRating(date, userId) {
            const row = await repository.findRating(date, userId);
            return row ? normalizeRatingRow(row) : null;
        },
        async saveRating(date, userId, body) {
            if (!await repository.findMenu(date)) {
                throw new AppError(404, 'MEAL_MENU_NOT_FOUND', 'Bu tarih için yemek menüsü bulunamadı.');
            }
            const profile = await repository.findUserProfile(userId);
            return normalizeRatingRow(await repository.saveRating(date, userId, body, profile));
        },
        async listMenus(query) {
            const pagination = parsePagination(query);
            const result = await repository.listMenus(...monthRange(query.month), pagination);
            return paginatedResponse(
                result.items.map(mapRow), result.total, pagination.page, pagination.pageSize
            );
        },
        async ratingSummary(month) {
            const [summary, overall] = await repository.ratingSummary(...monthRange(month));
            return { month, summary, overall };
        },
        async listRatings(query) {
            if (query.date && !query.date.startsWith(`${query.month}-`)) {
                throw new AppError(400, 'DATE_OUTSIDE_MONTH', 'Seçilen gün, rapor ayı içinde olmalıdır.');
            }
            const pagination = parsePagination(query);
            const result = await repository.listRatings(
                ...monthRange(query.month), query.date, pagination
            );
            return paginatedResponse(
                result.items, result.total, pagination.page, pagination.pageSize
            );
        },
        async exportRatings(month) {
            const result = await repository.listRatings(...monthRange(month));
            const header = [
                'Tarih', 'Sicil No', 'Ad Soyad', 'Departman', 'Pozisyon',
                'Yemek Puanı', 'Çalışan Tutumu Puanı', 'Temizlik Puanı',
                'Ortalama', 'Açıklama', 'Gönderim Tarihi'
            ];
            return '\uFEFF' + [
                header.map(csvEscape).join(';'),
                ...result.items.map(row => [
                    row.meal_date, row.employee_id, row.name, row.department,
                    row.position, row.food_score, row.staff_score,
                    row.cleanliness_score, row.avg_total_score, row.comment,
                    formatTurkeyDateTime(row.created_at)
                ].map(csvEscape).join(';'))
            ].join('\n');
        },
        async parsePdf(file, month) {
            if (!file) throw new AppError(400, 'PDF_REQUIRED', 'PDF dosyası yüklenmedi.');
            const ai = await parseWithAi(file.buffer, month).catch(error => ({
                enabled: true, menus: [], raw_text: '', error: error.message
            }));
            if (ai.enabled && ai.menus.length) {
                return {
                    source_file: file.originalname, raw_text: ai.raw_text,
                    parser: 'ai', ai_enabled: true, menus: ai.menus
                };
            }
            const parsed = await parseMealMenuPdf(file.buffer, month);
            return {
                source_file: file.originalname,
                raw_text: ai.raw_text || parsed.rawText,
                parser: parsed.parser,
                ai_enabled: ai.enabled,
                ai_error: ai.error || undefined,
                menus: parsed.menus
            };
        },
        saveMenus(body, userId) {
            return repository.saveMenus(body.menus, body.source_file, userId, splitItems);
        },
        async remove(date) {
            if (!(await repository.remove(date)).changes) {
                throw new AppError(404, 'MEAL_MENU_NOT_FOUND', 'Yemek menüsü bulunamadı.');
            }
        }
    };
}
module.exports = { createMealMenuService };
