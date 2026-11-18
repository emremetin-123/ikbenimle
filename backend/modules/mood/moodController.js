const { parsePagination } = require('../../core/pagination');

const MOOD_DATE_COOKIE = 'ikbenimle_mood_date';

function createMoodController(service) {
    return {
        today: async (req, res) => {
            res.json(await service.getToday(
                req.user.id,
                req.cookies?.[MOOD_DATE_COOKIE]
            ));
        },
        submit: async (req, res) => {
            const date = await service.submit(
                req.user.id,
                req.body,
                req.cookies?.[MOOD_DATE_COOKIE]
            );
            res.cookie(MOOD_DATE_COOKIE, date, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 36 * 60 * 60 * 1000,
                path: '/api/mood-check'
            });
            res.json({ success: true });
        },
        requestCallback: async (req, res) => {
            await service.requestCallback(
                req.user.id,
                req.cookies?.[MOOD_DATE_COOKIE]
            );
            res.json({ success: true });
        },
        report: async (req, res) => {
            res.json(await service.getReport(req.query, parsePagination(req.query)));
        },
        callbacks: async (req, res) => {
            res.json(await service.getCallbacks(req.query, parsePagination(req.query)));
        },
        exportReport: async (req, res) => {
            const csv = await service.exportReport(req.query);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="anonim-duygu-durumu-raporu.csv"'
            );
            res.send(csv);
        },
        analyze: async (req, res) => {
            res.json({ analysis: await service.analyze(req.body) });
        }
    };
}

module.exports = { createMoodController, MOOD_DATE_COOKIE };
