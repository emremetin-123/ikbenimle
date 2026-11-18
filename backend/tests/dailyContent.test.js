const test = require('node:test');
const assert = require('node:assert/strict');
const { setSetting, getSetting } = require('../services/appSettingsService');
const { updateTemplate, buildPayload } = require('../services/notificationTemplateService');
const delivery = require('../services/pushDeliveryService');
const { sendDailyContentIfDue, parseHistoryEvents } = require('../services/dailyContentService');
const quotePool = require('../content/dailyQuotes.json');

const wiki = `{{Gün}}
== Olaylar ==
* [[1886]] - [[Özgürlük Heykeli]], [[New York]]'a dikildi.
* [[1923]] - [[Mustafa Kemal Atatürk|Mustafa Kemal Paşa]], "Yarın Cumhuriyeti ilan edeceğiz" dedi.<ref>Kaynak</ref>
* [[2000]] - {{desteklenmeyen|şablon}}
== Doğumlar ==
* [[1900]] - Bir kişi doğdu.
`;

// Settings-only database fake: exercises the real template and settings services.
const settingsDb = (values = new Map()) => {
    return {
        all: async (_sql, keys) => keys.filter(key => values.has(key))
            .map(key => ({ setting_key: key, value: values.get(key) })),
        run: async (sql, params) => {
            if (sql.startsWith('UPDATE')) {
                if (!values.has(params[1])) return { changes: 0 };
                values.set(params[1], params[0]);
            } else values.set(params[0], params[1]);
            return { changes: 1 };
        }
    };
};
const enable = (db, key, time = '10:00') => updateTemplate(db, key, { enabled: true, time });

test('history extracts multiple Turkish events, removes markup, excludes births and unsupported templates', () => {
    assert.deepEqual(parseHistoryEvents(wiki), [
        "1886 - Özgürlük Heykeli, New York'a dikildi.",
        '1923 - Mustafa Kemal Paşa, "Yarın Cumhuriyeti ilan edeceğiz" dedi.'
    ]);
    assert.deepEqual(parseHistoryEvents(''), []);
});

test('quote library contains 365 unique readable sayings with stable IDs and revision sources', () => {
    const { quotes, sources } = quotePool;
    const normalize = text => text.normalize('NFC').toLocaleLowerCase('tr-TR')
        .replace(/[^\p{L}\p{N}]/gu, '');
    assert.equal(quotes.length, 365);
    assert.equal(new Set(quotes.map(quote => normalize(quote.text))).size, 365);
    assert.equal(new Set(quotes.map(quote => quote.id)).size, 365);
    for (const quote of quotes) {
        assert.match(quote.id, /^tr-[a-f0-9]{12}$/);
        assert.ok(quote.text.length >= 10 && quote.text.length <= 240);
        assert.equal(quote.text, quote.text.trim());
        assert.doesNotMatch(quote.text, /[{}<>]|\[\[|\]\]|\uFFFD/);
        assert.equal(quote.author, 'Türk atasözü');
        const source = new URL(sources[quote.source].url);
        assert.equal(source.origin, 'https://tr.wikiquote.org');
        assert.match(source.searchParams.get('oldid'), /^\d+$/);
    }
});

test('365 delivered quotes never repeat across gaps, leap years and new database connections', async t => {
    const values = new Map();
    await enable(settingsDb(values), 'quote_daily');
    const delivered = [];
    t.mock.method(delivery, 'isConfigured', async () => true);
    t.mock.method(delivery, 'sendTemplatedToAll', async (db, key, variables, overrides) => {
        const built = await buildPayload(db, key, variables, overrides);
        delivered.push(built.payload.body);
        return { sent: 1, failed: 0, skipped: false };
    });
    const start = Date.parse('2027-11-01T07:00:00Z');
    for (let day = 0; day < 366; day++) {
        // Fresh handles simulate restarts; three-day gaps must not skip library entries.
        const db = settingsDb(values);
        const now = new Date(start + day * 3 * 86400000);
        assert.equal((await sendDailyContentIfDue(db, 'quote_daily', { now })).sent, 1);
        assert.equal((await sendDailyContentIfDue(settingsDb(values), 'quote_daily', { now })).skipped, true);
    }
    assert.equal(delivered.length, 366);
    assert.equal(new Set(delivered.slice(0, 365)).size, 365);
    assert.equal(delivered[365], delivered[0]);
});

test('failed and skipped deliveries keep the same quote; progress survives a partial settings write', async t => {
    const values = new Map();
    const db = settingsDb(values);
    await enable(db, 'quote_daily');
    t.mock.method(delivery, 'isConfigured', async () => true);
    const attempts = [];
    let mode = 'fail';
    t.mock.method(delivery, 'sendTemplatedToAll', async (_db, _key, variables) => {
        attempts.push(variables.quote);
        if (mode === 'fail') throw new Error('temporary delivery failure');
        return { sent: mode === 'success' ? 1 : 0, failed: 0, skipped: mode === 'skip' };
    });
    const options = { now: new Date('2026-10-28T07:00:00Z') };
    await assert.rejects(sendDailyContentIfDue(db, 'quote_daily', options), /temporary/);
    assert.equal(await getSetting(db, 'daily_quote_progress'), '');
    mode = 'skip';
    await sendDailyContentIfDue(db, 'quote_daily', options);
    assert.equal(await getSetting(db, 'daily_quote_progress'), '');
    mode = 'success';
    const run = db.run;
    db.run = async (sql, params) => {
        if (params.includes('notification_template_quote_daily_last_sent_date')) {
            throw new Error('marker write failed');
        }
        return run(sql, params);
    };
    await assert.rejects(sendDailyContentIfDue(db, 'quote_daily', options), /marker write failed/);
    assert.equal(new Set(attempts).size, 1);
    // The quote's own persisted date still prevents repeating the delivered quote today.
    assert.equal((await sendDailyContentIfDue(settingsDb(values), 'quote_daily', options)).skipped, true);
    const next = { now: new Date('2026-12-05T07:00:00Z') };
    assert.equal((await sendDailyContentIfDue(settingsDb(values), 'quote_daily', next)).skipped, false);
    assert.notEqual(attempts.at(-1), attempts[0]);
});

test('daily notifications respect Istanbul time, defaults, restart markers and separate schedules', async t => {
    const db = settingsDb();
    const payloads = [];
    t.mock.method(delivery, 'isConfigured', async () => true);
    t.mock.method(delivery, 'sendTemplatedToAll', async (db, key, vars, overrides) => {
        payloads.push((await buildPayload(db, key, vars, overrides)).payload);
        return { sent: 1, failed: 0, skipped: false };
    });
    const now = new Date('2026-10-28T07:00:00Z'); // 10:00 Istanbul
    assert.equal((await sendDailyContentIfDue(db, 'quote_daily', { now })).skipped, true);
    await enable(db, 'quote_daily');
    await enable(db, 'history_today', '11:00');
    assert.equal((await sendDailyContentIfDue(db, 'quote_daily', {
        now: new Date('2026-10-28T06:59:00Z')
    })).skipped, true);
    assert.equal((await sendDailyContentIfDue(db, 'quote_daily', { now })).sent, 1);
    assert.match(payloads[0].body, /Türk atasözü/);
    assert.ok(!payloads[0].body.includes('{quote}'));
    assert.equal((await sendDailyContentIfDue(db, 'quote_daily', { now })).skipped, true);
    assert.equal((await sendDailyContentIfDue(db, 'history_today', { now })).skipped, true);
    await sendDailyContentIfDue(db, 'quote_daily', { now: new Date('2026-10-29T07:00:00Z') });
    assert.notEqual(payloads[0].body, payloads[1].body);
    assert.equal(await getSetting(db, 'notification_template_quote_daily_last_sent_date'), '2026-10-29');
});

test('Wikipedia uses Turkish date, caches content and retries failed delivery without another fetch', async t => {
    const db = settingsDb();
    await enable(db, 'history_today');
    t.mock.method(delivery, 'isConfigured', async () => true);
    let requests = 0;
    t.mock.method(global, 'fetch', async url => {
        requests++;
        assert.equal(new URL(url).searchParams.get('page'), '28 Ekim');
        return { ok: true, json: async () => ({ parse: { wikitext: wiki } }) };
    });
    const send = t.mock.method(delivery, 'sendTemplatedToAll', async () => { throw new Error('delivery unavailable'); });
    const options = { now: new Date('2026-10-28T07:00:00Z') };
    await assert.rejects(sendDailyContentIfDue(db, 'history_today', options), /delivery unavailable/);
    assert.equal(await getSetting(db, 'notification_template_history_today_last_sent_date'), '');
    send.mock.mockImplementation(async (db, key, variables, overrides) => {
        const built = await buildPayload(db, key, variables, overrides);
        assert.match(built.payload.url, /28_Ekim#Olaylar$/);
        assert.match(built.payload.body, /Vikipedi/);
        assert.ok(!built.payload.body.includes('{event}'));
        return { sent: 1, failed: 0, skipped: false };
    });
    assert.equal((await sendDailyContentIfDue(db, 'history_today', options)).sent, 1);
    assert.equal(requests, 1);
    assert.equal((await sendDailyContentIfDue(db, 'history_today', options)).skipped, true);
});

test('Wikipedia failure does not mark day sent or prevent quotes; missing push config avoids API calls', async t => {
    const db = settingsDb();
    await enable(db, 'history_today');
    await enable(db, 'quote_daily');
    const configured = t.mock.method(delivery, 'isConfigured', async () => false);
    const fetchMock = t.mock.method(global, 'fetch', async () => ({ ok: false, status: 503 }));
    t.mock.method(delivery, 'sendTemplatedToAll', async () => ({ sent: 1, failed: 0, skipped: false }));
    const options = { now: new Date('2026-10-28T07:00:00Z') };
    assert.equal((await sendDailyContentIfDue(db, 'history_today', options)).skipped, true);
    assert.equal(fetchMock.mock.callCount(), 0);
    configured.mock.mockImplementation(async () => true);
    await assert.rejects(sendDailyContentIfDue(db, 'history_today', options), /503/);
    await assert.rejects(sendDailyContentIfDue(db, 'history_today', options), /deferred/);
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(await getSetting(db, 'notification_template_history_today_last_sent_date'), '');
    assert.equal((await sendDailyContentIfDue(db, 'quote_daily', options)).sent, 1);
    await setSetting(db, 'notification_template_history_today_enabled', 'false');
    assert.equal((await sendDailyContentIfDue(db, 'history_today', options)).skipped, true);
});

test('all-device failures and empty audiences keep the quote and retry after fifteen minutes across restarts', async t => {
    for (const failed of [0, 2]) {
        const values = new Map();
        const db = settingsDb(values);
        await enable(db, 'quote_daily');
        t.mock.method(delivery, 'isConfigured', async () => true);
        const attempts = [];
        let accepted = false;
        t.mock.method(delivery, 'sendTemplatedToAll', async (_db, _key, variables) => {
            attempts.push(variables.quote);
            return { sent: accepted ? 1 : 0, failed, skipped: false };
        });
        const start = Date.parse('2026-10-29T07:00:00Z');
        await sendDailyContentIfDue(db, 'quote_daily', { now: new Date(start) });
        assert.equal(await getSetting(db, 'daily_quote_progress'), '');
        assert.equal(await getSetting(db, 'notification_template_quote_daily_last_sent_date'), '');
        const attempt = JSON.parse(await getSetting(db, 'notification_template_quote_daily_last_attempt'));
        assert.equal(attempt.status, failed ? 'failed' : 'no_devices');
        assert.equal((await sendDailyContentIfDue(settingsDb(values), 'quote_daily', { now: new Date(start + 14 * 60000) })).reason, 'Delivery retry is deferred');
        assert.equal(attempts.length, 1);
        accepted = true;
        assert.equal((await sendDailyContentIfDue(settingsDb(values), 'quote_daily', { now: new Date(start + 15 * 60000) })).sent, 1);
        assert.equal(new Set(attempts).size, 1);
        assert.equal(await getSetting(settingsDb(values), 'notification_template_quote_daily_last_sent_date'), '2026-10-29');
        assert.equal((await sendDailyContentIfDue(settingsDb(values), 'quote_daily', { now: new Date(start + 16 * 60000) })).reason, 'Already sent today');
        assert.equal(attempts.length, 2);
        assert.equal(JSON.parse(await getSetting(settingsDb(values), 'notification_template_quote_daily_last_attempt')).status, 'accepted');
        t.mock.restoreAll();
    }
});
