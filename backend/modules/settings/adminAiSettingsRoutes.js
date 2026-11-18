const express = require('express');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { getSettings, setSetting } = require('../../services/appSettingsService');
const { validate } = require('../../core/validation');
const { aiSettingsBodySchema } = require('./aiSettingsSchemas');

module.exports = function createAdminAiSettingsRoutes(db) {
    const router = express.Router();

    router.get('/ai-settings', authenticateToken, requirePermission('manage_ai_settings'), async (_req, res) => {
        try {
            const settings = await getSettings(db, ['gemini_model', 'chatbot_enabled']);
            const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
            const model = settings.gemini_model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';

            res.json({
                has_gemini_api_key: Boolean(apiKey),
                gemini_model: model,
                chatbot_enabled: settings.chatbot_enabled !== 'false'
            });
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    router.put(
        '/ai-settings',
        authenticateToken,
        requirePermission('manage_ai_settings'),
        validate({ body: aiSettingsBodySchema }),
        async (req, res) => {
        try {
            const geminiModel = req.body.gemini_model;
            const chatbotEnabled = req.body.chatbot_enabled ? 'true' : 'false';

            await setSetting(db, 'gemini_model', geminiModel);
            await setSetting(db, 'chatbot_enabled', chatbotEnabled);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    return router;
};
