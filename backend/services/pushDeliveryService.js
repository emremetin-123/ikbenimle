const webpush = require('web-push');
const { getSettings } = require('./appSettingsService');
const { buildPayload } = require('./notificationTemplateService');

const getVapidConfig = async (db) => {
    const settings = db ? await getSettings(db, ['vapid_public_key', 'vapid_subject']) : {};
    return {
        publicKey: settings.vapid_public_key || process.env.VAPID_PUBLIC_KEY || '',
        privateKey: process.env.VAPID_PRIVATE_KEY || '',
        subject: settings.vapid_subject || process.env.VAPID_SUBJECT || 'mailto:ik@example.com'
    };
};

const isConfigured = async (db) => {
    const { publicKey, privateKey } = await getVapidConfig(db);
    return Boolean(publicKey && privateKey);
};

const configureWebPush = async (db) => {
    if (!(await isConfigured(db))) return false;
    const { publicKey, privateKey, subject } = await getVapidConfig(db);
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
};

const normalizePayload = ({ title, body, url, tag }) => ({
    title: title || 'IKBenimle',
    body: body || '',
    url: url || '/employee/anasayfa',
    tag: tag || 'ikbenimle-notification',
    icon: '/logo.png',
    badge: '/logo.png'
});

const getActiveSubscriptions = async (db, userIds = null) => {
    if (Array.isArray(userIds) && userIds.length === 0) return [];
    if (Array.isArray(userIds)) {
        const placeholders = userIds.map(() => '?').join(',');
        return db.all(
            `SELECT id, user_id, endpoint, subscription_json, device_label
             FROM push_subscriptions
             WHERE is_active = 1 AND user_id IN (${placeholders})`,
            userIds
        );
    }
    return db.all(`
        SELECT id, user_id, endpoint, subscription_json, device_label
        FROM push_subscriptions
        WHERE is_active = 1
    `);
};

const deactivateSubscription = async (db, id) => {
    try {
        await db.run('UPDATE push_subscriptions SET is_active = 0 WHERE id = ?', [id]);
    } catch (err) {
        console.error('Push subscription deactivate error:', err.message);
    }
};

const sendToSubscriptions = async (db, subscriptions, payloadInput) => {
    if (!(await configureWebPush(db))) {
        return { sent: 0, failed: 0, skipped: true, reason: 'VAPID keys are not configured' };
    }

    const payload = JSON.stringify(normalizePayload(payloadInput));
    let sent = 0;
    let failed = 0;
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < subscriptions.length) {
            const row = subscriptions[nextIndex++];
            try {
                await webpush.sendNotification(JSON.parse(row.subscription_json), payload);
                sent += 1;
            } catch (err) {
                failed += 1;
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await deactivateSubscription(db, row.id);
                } else {
                    console.error('Push send error:', err.message);
                }
            }
        }
    };
    const concurrency = Math.min(8, subscriptions.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return { sent, failed, skipped: false };
};

const sendToAll = async (db, payload) =>
    sendToSubscriptions(db, await getActiveSubscriptions(db), payload);

const sendToUsers = async (db, userIds, payload) =>
    sendToSubscriptions(db, await getActiveSubscriptions(db, userIds), payload);

const sendToDepartment = async (db, department, payload) => {
    if (!department) return { sent: 0, failed: 0, skipped: false };
    const users = await db.all(
        'SELECT id FROM users WHERE department = ? AND COALESCE(status, ?) = ?',
        [department, 'active', 'active']
    );
    return sendToUsers(db, users.map(user => user.id), payload);
};

const sendTemplated = async (sender, db, templateKey, variables, overrides) => {
    const built = await buildPayload(db, templateKey, variables, overrides);
    if (!built.enabled) {
        return {
            sent: 0,
            failed: 0,
            skipped: true,
            reason: `${templateKey} template is disabled`
        };
    }
    return sender(built.payload);
};

const sendTemplatedToAll = (db, templateKey, variables = {}, overrides = {}) =>
    sendTemplated(payload => sendToAll(db, payload), db, templateKey, variables, overrides);

const sendTemplatedToUsers = (db, userIds, templateKey, variables = {}, overrides = {}) =>
    sendTemplated(payload => sendToUsers(db, userIds, payload), db, templateKey, variables, overrides);

const sendTemplatedToDepartment = (db, department, templateKey, variables = {}, overrides = {}) =>
    sendTemplated(
        payload => sendToDepartment(db, department, payload),
        db,
        templateKey,
        variables,
        overrides
    );

const saveSubscription = async (db, userId, subscription, deviceLabel = '') => {
    const endpoint = subscription?.endpoint;
    if (!endpoint) throw new Error('Push endpoint missing');

    const subscriptionJson = JSON.stringify(subscription);
    const existing = await db.get('SELECT id FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    if (existing) {
        await db.run(
            'UPDATE push_subscriptions SET user_id = ?, subscription_json = ?, device_label = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [userId, subscriptionJson, deviceLabel || null, existing.id]
        );
        return existing.id;
    }

    const result = await db.run(
        'INSERT INTO push_subscriptions (user_id, endpoint, subscription_json, device_label) VALUES (?, ?, ?, ?)',
        [userId, endpoint, subscriptionJson, deviceLabel || null]
    );
    return result.lastID;
};

module.exports = {
    getVapidConfig,
    isConfigured,
    saveSubscription,
    sendToAll,
    sendToUsers,
    sendToDepartment,
    sendTemplatedToAll,
    sendTemplatedToUsers,
    sendTemplatedToDepartment
};
