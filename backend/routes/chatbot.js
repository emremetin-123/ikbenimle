const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const { generateGeminiText } = require('../services/geminiTextService');
const { buildChatbotContext, buildChatbotPrompt } = require('../services/chatbotContextService');
const { getSetting } = require('../services/appSettingsService');
const { aiLimiter } = require('../middleware/rateLimits');
const { validate } = require('../core/validation');
const { chatbotAskBodySchema } = require('../modules/chatbot/chatbotSchemas');

const isChatbotEnabled = async (db) => {
    const value = await getSetting(db, 'chatbot_enabled');
    return value !== 'false';
};

module.exports = (db) => {
    router.get('/settings', authenticateToken, async (_req, res) => {
        try {
            res.json({ enabled: await isChatbotEnabled(db) });
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    router.post('/ask', authenticateToken, aiLimiter, validate({ body: chatbotAskBodySchema }), async (req, res) => {
        try {
            if (!(await isChatbotEnabled(db))) {
                return res.status(403).json({ error: 'Portal asistani su anda kapali.' });
            }
            const { message } = req.body;

            const context = await buildChatbotContext(db, req.user);
            const prompt = buildChatbotPrompt(message, context);
            const answer = await generateGeminiText(db, prompt);

            res.json({ answer });
        } catch (err) {
            console.error('Chatbot error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    return router;
};
