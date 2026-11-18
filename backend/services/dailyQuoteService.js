const { getSetting, setSetting } = require('./appSettingsService');
const { quotes, sources } = require('../content/dailyQuotes.json');

const PROGRESS_KEY = 'daily_quote_progress';

const getNextQuote = async (db, date) => {
    let progress = {};
    try {
        progress = JSON.parse(await getSetting(db, PROGRESS_KEY)) || {};
    } catch { /* Missing or invalid progress starts a new cycle. */ }
    if (progress.date === date) return null;
    const previous = quotes.findIndex(quote => quote.id === progress.id);
    const quote = quotes[(previous + 1) % quotes.length];
    return {
        id: quote.id,
        date,
        quote: quote.text,
        author: quote.author,
        sourceUrl: sources[quote.source].url
    };
};

// Persist only after delivery starts successfully, so skipped/failed attempts keep their place.
const recordQuoteDelivery = (db, quote) => setSetting(db, PROGRESS_KEY, JSON.stringify({
    date: quote.date,
    id: quote.id
}));

module.exports = { getNextQuote, recordQuoteDelivery };
