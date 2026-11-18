const { getSetting, setSetting } = require('./appSettingsService');
const { getTemplate } = require('./notificationTemplateService');
const pushDelivery = require('./pushDeliveryService');
const { getNextQuote, recordQuoteDelivery } = require('./dailyQuoteService');

const dateTime = now => ({
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now),
    time: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(now)
});

// Only simple, fully readable event lines are accepted; unsupported wiki markup is skipped.
const parseHistoryEvents = wikitext => {
    const section = String(wikitext || '').match(/^==\s*Olaylar\s*==[^\S\n]*\r?\n([\s\S]*?)(?=^==\s|(?![\s\S]))/m)?.[1] || '';
    return section.split('\n')
        .filter(line => /^\*\s+\[\[\d{1,4}\]\]/.test(line))
        .map(line => line.replace(/^\*\s+/, '')
            .replace(/<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
            .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
            .replace(/'{2,5}/g, '')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
            .trim())
        .filter(line => line.length > 15 && line.length <= 500 && !/[{}\[\]<>]|&\w+;/.test(line));
};

const retryAfter = new WeakMap();
const getHistory = async (db, date) => {
    const cacheKey = 'daily_history_content';
    const cached = await getSetting(db, cacheKey);
    if (cached) {
        try {
            const content = JSON.parse(cached);
            if (content.date === date && content.event && content.sourceUrl) return content;
        } catch { /* A malformed cache is replaced by fresh content. */ }
    }
    if ((retryAfter.get(db) || 0) > Date.now()) throw new Error('Wikipedia retry is deferred');
    try {
        const day = new Date(`${date}T12:00:00Z`);
        const page = new Intl.DateTimeFormat('tr-TR', {
            timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long'
        }).format(day);
        const params = new URLSearchParams({
            action: 'parse', format: 'json', formatversion: '2', page, prop: 'wikitext'
        });
        const response = await fetch(`https://tr.wikipedia.org/w/api.php?${params}`, {
            headers: { 'User-Agent': 'CalisanPortal/1.0 (daily-history notifications)' },
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`);
        const data = await response.json();
        const events = parseHistoryEvents(data.parse?.wikitext);
        if (!events.length) throw new Error('Wikipedia returned no readable events');
        const index = Math.floor(day.getTime() / 86400000) % events.length;
        const content = {
            date, event: events[index],
            sourceUrl: `https://tr.wikipedia.org/wiki/${encodeURIComponent(page.replace(/ /g, '_'))}#Olaylar`
        };
        await setSetting(db, cacheKey, JSON.stringify(content));
        retryAfter.delete(db);
        return content;
    } catch (error) {
        retryAfter.set(db, Date.now() + 15 * 60 * 1000);
        throw error;
    }
};

const running = new WeakMap();
const sendDailyContentIfDue = async (db, key, options = {}) => {
    if (!['history_today', 'quote_daily'].includes(key)) throw new Error('Unknown daily content');
    const { date, time } = dateTime(options.now || new Date());
    const skipped = reason => ({ sent: 0, failed: 0, skipped: true, reason, date, time });
    let active = running.get(db);
    if (!active) { active = new Set(); running.set(db, active); }
    if (active.has(key)) return skipped('Daily content is already running');
    active.add(key);
    try {
        const template = await getTemplate(db, key);
        if (!template.enabled) return skipped('Daily content is disabled');
        if (time < template.scheduled_time) return skipped('Scheduled time has not arrived');
        const sentKey = `notification_template_${key}_last_sent_date`;
        if (await getSetting(db, sentKey) === date) return skipped('Already sent today');
        const attemptKey = `notification_template_${key}_last_attempt`;
        let previousAttempt;
        try { previousAttempt = JSON.parse(await getSetting(db, attemptKey)); } catch { /* No prior attempt. */ }
        const attemptTime = options.now || new Date();
        if (previousAttempt?.date === date && previousAttempt.retry_at && new Date(previousAttempt.retry_at) > attemptTime) {
            return skipped('Delivery retry is deferred');
        }
        if (!(await pushDelivery.isConfigured(db))) return skipped('VAPID keys are not configured');
        const variables = key === 'history_today'
            ? await getHistory(db, date)
            : await getNextQuote(db, date);
        if (!variables) return skipped('Already sent today');
        let result;
        try { result = await pushDelivery.sendTemplatedToAll(db, key, variables, {
            tag: `${key}-${date}`,
            ...(key === 'history_today' && template.url === template.defaultUrl
                ? { url: variables.sourceUrl } : {})
        }); } catch (error) {
            await setSetting(db, attemptKey, JSON.stringify({ date, attempted_at: attemptTime.toISOString(), status: 'error', sent: 0, failed: 0 }));
            throw error;
        }
        const accepted = !result.skipped && result.sent > 0;
        await setSetting(db, attemptKey, JSON.stringify({
            date, attempted_at: attemptTime.toISOString(), sent: result.sent, failed: result.failed,
            status: accepted ? 'accepted' : result.failed > 0 ? 'failed' : result.skipped ? 'skipped' : 'no_devices',
            ...(!accepted && !result.skipped ? { retry_at: new Date(attemptTime.getTime() + 15 * 60 * 1000).toISOString() } : {})
        }));
        if (accepted) {
            if (key === 'quote_daily') await recordQuoteDelivery(db, variables);
            await setSetting(db, sentKey, date);
        }
        return { ...result, date, time };
    } finally {
        active.delete(key);
    }
};

module.exports = { sendDailyContentIfDue, parseHistoryEvents };
