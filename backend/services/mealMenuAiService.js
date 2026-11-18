const DEFAULT_MODEL = 'gemini-3.5-flash';
const { geminiError } = require('./geminiError');
const { getSettings } = require('./appSettingsService');

const normalizeAiItem = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;.,-]+|[\s:;.,-]+$/g, '')
    .trim();

const parseMonthValue = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]) };
};

const maxDayForMonth = (monthValue) => {
    const parsed = parseMonthValue(monthValue);
    if (!parsed) return 0;
    return new Date(parsed.year, parsed.month, 0).getDate();
};

const isValidMealDate = (value, monthValue) => {
    const parsed = parseMonthValue(monthValue);
    if (!parsed) return false;

    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return year === parsed.year && month === parsed.month && day >= 1 && day <= maxDayForMonth(monthValue);
};

const safeJsonParse = (text) => {
    const source = String(text || '').trim();
    if (!source) return null;

    try {
        return JSON.parse(source);
    } catch {
        const match = source.match(/\[[\s\S]*\]/);
        if (!match) return null;
        return JSON.parse(match[0]);
    }
};

const normalizeAiMenus = (payload, monthValue) => {
    const rows = Array.isArray(payload) ? payload : payload?.menus;
    if (!Array.isArray(rows)) return [];

    return rows
        .map(row => ({
            meal_date: String(row?.meal_date || '').slice(0, 10),
            items: Array.isArray(row?.items)
                ? row.items.map(normalizeAiItem).filter(Boolean)
                : []
        }))
        .filter(row => isValidMealDate(row.meal_date, monthValue) && row.items.length > 0)
        .sort((a, b) => a.meal_date.localeCompare(b.meal_date));
};

const getGeminiConfig = async (db) => {
    const settings = db ? await getSettings(db, ['gemini_model']) : {};

    return {
        apiKey: String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '')
            .replace(/\s+/g, ''),
        model: String(settings.gemini_model || process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
    };
};

const buildPrompt = (monthValue) => {
    const parsed = parseMonthValue(monthValue);
    const maxDay = maxDayForMonth(monthValue);

    return [
        'Bu PDF bir aylik yemek menusu tablosudur.',
        `Hedef ay: ${parsed.year}-${String(parsed.month).padStart(2, '0')}. Bu ay ${maxDay} gun cekiyor.`,
        'PDF farkli tablo formatlarinda, goruntu tabanli veya metin tabanli olabilir.',
        'Her gun icin sadece yemek kalemlerini cikar.',
        'Tarih, gun adi, baslik, firma adi, bos hucre, kaloriler ve tekrar eden tablo etiketlerini yemek listesine ekleme.',
        'Yemek adlarini Turkce karakterlerle duzgun yaz.',
        'Bir gunun menusu yoksa o gunu dahil etme.',
        'Cevabi sadece JSON olarak ver. Markdown, aciklama veya kod blogu kullanma.',
        'Beklenen format:',
        '[{"meal_date":"YYYY-MM-DD","items":["Corba","Ana yemek","Yardimci yemek"]}]'
    ].join('\n');
};

const buildSchema = () => ({
    type: 'array',
    items: {
        type: 'object',
        properties: {
            meal_date: {
                type: 'string',
                description: 'ISO tarih. Ornek: 2026-07-01'
            },
            items: {
                type: 'array',
                items: { type: 'string' }
            }
        },
        required: ['meal_date', 'items']
    }
});

const extractInteractionText = (result) => {
    if (typeof result?.output_text === 'string') return result.output_text;
    if (typeof result?.outputText === 'string') return result.outputText;

    const stepText = result?.steps
        ?.flatMap(step => step?.content || [])
        ?.map(part => part?.text || '')
        ?.join('')
        ?.trim();
    if (stepText) return stepText;

    return result?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        ?.join('')
        ?.trim() || '';
};

async function parseMealMenuWithGemini(buffer, monthValue, db) {
    const { apiKey, model } = await getGeminiConfig(db);
    if (!apiKey) {
        return {
            enabled: false,
            menus: [],
            raw_text: '',
            error: 'GEMINI_API_KEY tanimli degil'
        };
    }

    if (typeof fetch !== 'function') {
        return {
            enabled: true,
            menus: [],
            raw_text: '',
            error: 'Bu Node.js surumunde fetch desteklenmiyor'
        };
    }

    const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
            model,
            input: [
                {
                    type: 'document',
                    data: buffer.toString('base64'),
                    mime_type: 'application/pdf'
                },
                { type: 'text', text: buildPrompt(monthValue) }
            ],
            response_format: {
                type: 'text',
                mime_type: 'application/json',
                schema: buildSchema()
            }
        })
    });

    const resultText = await response.text();
    if (!response.ok) {
        return {
            enabled: true,
            menus: [],
            raw_text: '',
            error: geminiError(response.status, resultText)
        };
    }

    const result = safeJsonParse(resultText);
    const answerText = extractInteractionText(result);

    const answerJson = safeJsonParse(answerText);
    return {
        enabled: true,
        menus: normalizeAiMenus(answerJson, monthValue),
        raw_text: answerText || resultText,
        error: ''
    };
}

module.exports = {
    parseMealMenuWithGemini
};
