const { z } = require('zod');

const aiSettingsBodySchema = z.object({
    gemini_model: z.string()
        .trim()
        .min(1)
        .max(100)
        .regex(/^[A-Za-z0-9._-]+$/),
    chatbot_enabled: z.boolean()
}).strict();

module.exports = { aiSettingsBodySchema };
