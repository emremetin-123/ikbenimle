const { z } = require('zod');

const chatbotAskBodySchema = z.object({
    message: z.string().trim().min(1).max(1200)
}).strict();

module.exports = { chatbotAskBodySchema };
