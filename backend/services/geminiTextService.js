const { getSettings } = require('./appSettingsService');
const { geminiError } = require('./geminiError');

const DEFAULT_MODEL = 'gemini-3.5-flash';

const getGeminiConfig = async (db) => {
    const settings = db ? await getSettings(db, ['gemini_model']) : {};
    return {
        apiKey: String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '')
            .replace(/\s+/g, ''),
        model: String(settings.gemini_model || process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
    };
};

async function generateGeminiText(db, prompt) {
    const { apiKey, model } = await getGeminiConfig(db);
    if (!apiKey) {
        throw new Error('Gemini anahtarı sunucuda tanımlı değil. Sunucu yapılandırması kontrol edilmeli.');
    }
    if (typeof fetch !== 'function') {
        throw new Error('Bu Node.js sürümünde fetch desteklenmiyor.');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2
                }
            })
        }
    );

    const text = await response.text();
    if (!response.ok) {
        throw new Error(geminiError(response.status, text));
    }

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        return text;
    }

    return parsed?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim() || text;
}

module.exports = {
    generateGeminiText
};
