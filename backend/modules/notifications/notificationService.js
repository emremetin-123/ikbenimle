const { AppError } = require('../../core/http');
const { paginatedResponse, parsePagination } = require('../../core/pagination');
const pushService = require('../../services/pushNotificationService');
const templateService = require('../../services/notificationTemplateService');
const { getSettings, setSetting } = require('../../services/appSettingsService');

const SETTINGS_KEYS = [
    'vapid_public_key',
    'vapid_subject',
    'push_mood_reminder_time',
    'push_mood_reminder_enabled',
    'push_mood_reminder_title',
    'push_mood_reminder_body'
];

function createNotificationService(db, repository) {
    const requireRoutine = async id => {
        const routine = await repository.findRoutine(id);
        if (!routine) {
            throw new AppError(
                404,
                'NOTIFICATION_ROUTINE_NOT_FOUND',
                'Rutin bulunamadı.'
            );
        }
        return routine;
    };

    return {
        async vapidConfig() {
            const config = await pushService.getVapidConfig(db);
            return {
                publicKey: config.publicKey,
                configured: await pushService.isConfigured(db)
            };
        },
        subscribe(userId, body) {
            return pushService.saveSubscription(
                db,
                userId,
                body.subscription,
                body.deviceLabel
            );
        },
        unsubscribe(userId, endpoint) {
            return repository.deactivateSubscription(userId, endpoint);
        },
        testUser(userId) {
            return pushService.sendToUsers(db, [userId], {
                title: 'Bildirimler aktif',
                body: 'Telefon bildirimleri bu cihazda açıldı.',
                url: '/employee/anasayfa',
                tag: `push-test-${userId}-${Date.now()}`
            });
        },
        stats: () => repository.getStats(),
        async listSubscriptions(query) {
            const result = await repository.listSubscriptions(query);
            return paginatedResponse(result.items, result.total, result.pagination.page, result.pagination.pageSize);
        },
        send(body) {
            const payload = {
                title: body.title,
                body: body.body,
                url: body.url,
                tag: `manual-${Date.now()}`
            };
            if (body.target === 'department') {
                return pushService.sendToDepartment(db, body.department, payload);
            }
            if (body.target === 'users') {
                return pushService.sendToUsers(db, [...new Set(body.userIds)], payload);
            }
            return pushService.sendToAll(db, payload);
        },
        sendMoodReminder: () => pushService.sendMoodReminderIfDue(db, { force: true }),
        sendBirthday: () => pushService.sendBirthdayNotificationsIfDue(db, { force: true }),
        async listTemplates(query) {
            const { page, pageSize } = parsePagination(query);
            const search = query.search?.toLocaleLowerCase('tr-TR');
            const templates = (await templateService.getTemplates(db)).filter(template => {
                if (query.status === 'active' && !template.enabled) return false;
                if (query.status === 'passive' && template.enabled) return false;
                if (!search) return true;
                return [
                    template.label,
                    template.group,
                    template.description,
                    template.title,
                    template.body
                ].some(value => String(value || '')
                    .toLocaleLowerCase('tr-TR')
                    .includes(search));
            });
            const dailyKeys = ['history_today', 'quote_daily'];
            const deliverySettings = await getSettings(db, dailyKeys.flatMap(key => [
                `notification_template_${key}_last_sent_date`, `notification_template_${key}_last_attempt`
            ]));
            for (const template of templates) {
                if (!dailyKeys.includes(template.key)) continue;
                let attempt = null;
                try {
                    const saved = JSON.parse(deliverySettings[`notification_template_${template.key}_last_attempt`] || 'null');
                    if (saved && ['accepted', 'failed', 'error', 'skipped', 'no_devices'].includes(saved.status)) {
                        attempt = { status: saved.status, attempted_at: saved.attempted_at, sent: Number(saved.sent || 0), failed: Number(saved.failed || 0), retry_at: saved.retry_at || null };
                    }
                } catch { /* Older installations have no delivery diagnostics. */ }
                template.delivery = { last_processed_date: deliverySettings[`notification_template_${template.key}_last_sent_date`] || null, last_attempt: attempt };
            }
            const start = (page - 1) * pageSize;
            return paginatedResponse(
                templates.slice(start, start + pageSize),
                templates.length,
                page,
                pageSize
            );
        },
        async updateTemplate(key, body) {
            const known = templateService.getTemplateDefinitions()
                .some(template => template.key === key);
            if (!known) {
                throw new AppError(
                    404,
                    'NOTIFICATION_TEMPLATE_NOT_FOUND',
                    'Bildirim şablonu bulunamadı.'
                );
            }
            return templateService.updateTemplate(db, key, body);
        },
        async listRoutines(query) {
            const result = await repository.listRoutines(query);
            return paginatedResponse(
                result.items,
                result.total,
                result.pagination.page,
                result.pagination.pageSize
            );
        },
        async createRoutine(body, userId) {
            return requireRoutine(await repository.createRoutine(body, userId));
        },
        async updateRoutine(id, body) {
            const result = await repository.updateRoutine(id, body);
            if (!result.changes) {
                throw new AppError(
                    404,
                    'NOTIFICATION_ROUTINE_NOT_FOUND',
                    'Rutin bulunamadı.'
                );
            }
            return requireRoutine(id);
        },
        async deleteRoutine(id) {
            const result = await repository.deleteRoutine(id);
            if (!result.changes) {
                throw new AppError(
                    404,
                    'NOTIFICATION_ROUTINE_NOT_FOUND',
                    'Rutin bulunamadı.'
                );
            }
        },
        async sendRoutine(id) {
            return pushService.sendRoutine(db, await requireRoutine(id));
        },
        async getSettings() {
            const settings = await getSettings(db, SETTINGS_KEYS);
            return {
                vapid_public_key: settings.vapid_public_key
                    || process.env.VAPID_PUBLIC_KEY || '',
                vapid_private_key_configured: Boolean(process.env.VAPID_PRIVATE_KEY),
                vapid_subject: settings.vapid_subject
                    || process.env.VAPID_SUBJECT || 'mailto:ik@example.com',
                push_mood_reminder_time: settings.push_mood_reminder_time
                    || process.env.PUSH_MOOD_REMINDER_TIME || '09:00',
                push_mood_reminder_enabled: settings.push_mood_reminder_enabled
                    || process.env.PUSH_MOOD_REMINDER_ENABLED || 'false',
                push_mood_reminder_title: settings.push_mood_reminder_title
                    || process.env.PUSH_MOOD_REMINDER_TITLE
                    || 'Bugün kendini nasıl hissediyorsun?',
                push_mood_reminder_body: settings.push_mood_reminder_body
                    || process.env.PUSH_MOOD_REMINDER_BODY
                    || 'Günlük duygu durumunu paylaşmak ister misin?'
            };
        },
        async updateSettings(body) {
            await Promise.all(
                Object.entries(body).map(([key, value]) => (
                    setSetting(db, key, String(value))
                ))
            );
        }
    };
}

module.exports = { createNotificationService };
