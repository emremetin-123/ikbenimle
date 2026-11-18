const { AppError } = require('../core/http');

const MIN_ANONYMOUS_COHORT = Math.max(
    3,
    Number.parseInt(process.env.MOOD_ANONYMITY_THRESHOLD || '3', 10) || 3
);

const getTodayIso = () => {
    const parts = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const getDateRange = (input = {}) => {
    const today = getTodayIso();
    const fallback = new Date(`${today}T12:00:00Z`);
    fallback.setUTCDate(fallback.getUTCDate() - 30);
    const from = input.from || fallback.toISOString().slice(0, 10);
    const to = input.to || today;
    if (from > to) {
        throw new AppError(
            400,
            'INVALID_DATE_RANGE',
            'Bitiş tarihi başlangıç tarihinden önce olamaz.'
        );
    }
    return { from, to, department: String(input.department || '').trim() };
};

const csvEscape = (value) => {
    const text = String(value ?? '');
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const moodGroupsToCsv = rows => {
    const headers = ['Tarih', 'Departman', 'Duygu', 'Skor', 'Sebep', 'Yanıt Sayısı'];
    const lines = rows.map(row => [
        row.mood_date,
        row.department,
        row.mood_label,
        row.mood_score,
        row.reason_label || '',
        row.response_count
    ].map(csvEscape).join(';'));
    return ['\uFEFF' + headers.join(';'), ...lines].join('\n');
};

module.exports = {
    MIN_ANONYMOUS_COHORT,
    getTodayIso,
    getDateRange,
    moodGroupsToCsv
};
