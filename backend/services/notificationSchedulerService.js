const crypto = require('node:crypto');
const { getSettings, setSetting } = require('./appSettingsService');
const { getTemplate } = require('./notificationTemplateService');
const pushDelivery = require('./pushDeliveryService');
const { sendDailyContentIfDue } = require('./dailyContentService');

const MOOD_REMINDER_KEYS = [
    'push_mood_reminder_time',
    'push_mood_reminder_enabled',
    'push_mood_reminder_last_sent_date',
    'push_mood_reminder_title',
    'push_mood_reminder_body'
];

const getIstanbulDateTime = () => {
    const now = new Date();
    return {
        date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now),
        time: new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Istanbul',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(now)
    };
};

const toDateKey = (value) => {
    if (!value) return '';
    if (value instanceof Date) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(value);
    }
    const stringValue = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) return stringValue.slice(0, 10);
    const parsed = new Date(stringValue);
    if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(parsed);
    }
    return stringValue.slice(0, 10);
};

const sendMoodReminderIfDue = async (db, options = {}) => {
    const settings = await getSettings(db, MOOD_REMINDER_KEYS);
    const reminderTime = settings.push_mood_reminder_time || process.env.PUSH_MOOD_REMINDER_TIME || '09:00';
    const enabled = settings.push_mood_reminder_enabled || process.env.PUSH_MOOD_REMINDER_ENABLED || 'true';
    const { date, time } = getIstanbulDateTime();

    if (enabled === 'false' && !options.force) {
        return { sent: 0, failed: 0, skipped: true, reason: 'Mood reminder is disabled', date, time };
    }
    if (!options.force && time < reminderTime) {
        return { sent: 0, failed: 0, skipped: true, reason: 'Mood reminder time has not arrived', date, time };
    }
    if (!options.force && settings.push_mood_reminder_last_sent_date === date) {
        return { sent: 0, failed: 0, skipped: true, reason: 'Mood reminder already sent today', date, time };
    }

    const result = await pushDelivery.sendTemplatedToAll(db, 'mood_daily', {}, {
        force: options.force,
        title: settings.push_mood_reminder_title || undefined,
        body: settings.push_mood_reminder_body || undefined,
        url: '/employee/anasayfa',
        tag: `mood-${date}`
    });
    if (!result.skipped && !options.force) {
        await setSetting(db, 'push_mood_reminder_last_sent_date', date);
    }
    return { ...result, date, time };
};

const sendBirthdayNotificationsIfDue = async (db, options = {}) => {
    const { date, time } = getIstanbulDateTime();
    const template = await getTemplate(db, 'birthday_today');
    if (!template.enabled && !options.force) {
        return { sent: 0, failed: 0, skipped: true, reason: 'Birthday notification is disabled', date, time };
    }
    if (!options.force && template.scheduled_time && time < template.scheduled_time) {
        return { sent: 0, failed: 0, skipped: true, reason: 'Birthday notification time has not arrived', date, time };
    }
    const settings = await getSettings(db, ['notification_template_birthday_today_last_sent_date']);
    if (!options.force && settings.notification_template_birthday_today_last_sent_date === date) {
        return { sent: 0, failed: 0, skipped: true, reason: 'Birthday notification already sent today', date, time };
    }

    const [, month, day] = date.split('-');
    const birthdayPredicate = process.env.DB_TYPE === 'postgres'
        ? 'EXTRACT(MONTH FROM p.birth_date) = ? AND EXTRACT(DAY FROM p.birth_date) = ?'
        : "strftime('%m', p.birth_date) = ? AND strftime('%d', p.birth_date) = ?";
    const nonEmptyBirthDate = process.env.DB_TYPE === 'postgres'
        ? ''
        : "AND p.birth_date <> ''";
    const users = await db.all(
        `SELECT u.id, u.name, u.department, p.birth_date
         FROM users u
         JOIN personal_info p ON p.user_id = u.id
         WHERE COALESCE(u.status, ?) = ?
           AND p.birth_date IS NOT NULL
           ${nonEmptyBirthDate}
           AND ${birthdayPredicate}
         ORDER BY u.name`,
        ['active', 'active', month, day]
    );
    if (!users.length) {
        if (!options.force) {
            await setSetting(db, 'notification_template_birthday_today_last_sent_date', date);
        }
        return { sent: 0, failed: 0, skipped: true, reason: 'No birthdays today', date, time };
    }

    const names = users.map(user => user.name).join(', ');
    const result = await pushDelivery.sendTemplatedToAll(db, 'birthday_today', {
        names,
        count: users.length
    }, {
        force: options.force,
        tag: `birthday-${date}`
    });
    if (!result.skipped && !options.force) {
        await setSetting(db, 'notification_template_birthday_today_last_sent_date', date);
    }
    return { ...result, date, time, birthday_count: users.length, names };
};

const normalizeRoutine = (routine) => ({
    ...routine,
    is_active: routine.is_active === true || routine.is_active === 1 || routine.is_active === '1'
});

const sendRoutine = async (db, routine) => {
    const payload = {
        title: routine.title,
        body: routine.body,
        url: routine.url || '/employee/anasayfa',
        tag: `routine-${routine.id}-${Date.now()}`
    };
    return routine.target === 'department'
        ? pushDelivery.sendToDepartment(db, routine.department, payload)
        : pushDelivery.sendToAll(db, payload);
};

const sendDueNotificationRoutines = async (db) => {
    const { date, time } = getIstanbulDateTime();
    const routines = await db.all(`
        SELECT id, title, body, url, target, department, schedule_type,
               scheduled_date, scheduled_time, is_active, last_sent_key
        FROM notification_routines
        WHERE is_active = 1
    `);
    const results = [];
    for (const rawRoutine of routines) {
        const routine = normalizeRoutine(rawRoutine);
        const scheduleType = routine.schedule_type || 'daily';
        const scheduledTime = routine.scheduled_time || '09:00';
        const scheduledDate = toDateKey(routine.scheduled_date);
        const sendKey = scheduleType === 'once' ? scheduledDate : date;
        if (time < scheduledTime) continue;
        if (scheduleType === 'once' && (!scheduledDate || scheduledDate > date)) continue;
        if (routine.last_sent_key === sendKey) continue;

        const result = await sendRoutine(db, routine);
        if (!result.skipped) {
            await db.run(
                'UPDATE notification_routines SET last_sent_key = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [sendKey, scheduleType === 'once' ? 0 : (routine.is_active ? 1 : 0), routine.id]
            );
        }
        results.push({ id: routine.id, title: routine.title, ...result });
    }
    return { date, time, results };
};

const sendDuePolyvalenceReminders = async (db) => {
    if (!(await pushDelivery.isConfigured(db))) {
        return { skipped: true, reason: 'VAPID keys are not configured', results: [] };
    }
    const { date } = getIstanbulDateTime();
    const today = new Date(`${date}T12:00:00Z`);
    const tasks = await db.all(
        `SELECT t.id, t.evaluator_user_id, t.status, p.name AS period_name, p.due_date,
                d.name AS department_name, s.reminder_days
         FROM polyvalence_review_tasks t
         JOIN polyvalence_periods p ON p.id = t.period_id
         JOIN polyvalence_departments d ON d.id = p.department_id
         LEFT JOIN polyvalence_schedules s ON s.department_id = p.department_id
         WHERE p.status = 'open' AND t.status <> 'completed' AND t.status <> 'cancelled'`
    );
    const results = [];
    for (const task of tasks) {
        const dueDate = toDateKey(task.due_date);
        if (!dueDate) continue;
        const due = new Date(`${dueDate}T12:00:00Z`);
        const daysLeft = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        const reminderDays = String(task.reminder_days || '7,3,1')
            .split(',')
            .map(Number)
            .filter(value => Number.isInteger(value) && value >= 0);
        if (!reminderDays.includes(daysLeft)) continue;

        const notificationKey = `${dueDate}:${daysLeft}`;
        const existing = await db.get(
            'SELECT id FROM polyvalence_notification_logs WHERE task_id = ? AND notification_key = ?',
            [task.id, notificationKey]
        );
        if (existing) continue;
        try {
            await db.run(
                'INSERT INTO polyvalence_notification_logs (task_id, notification_key) VALUES (?, ?)',
                [task.id, notificationKey]
            );
        } catch {
            continue;
        }

        const result = await pushDelivery.sendTemplatedToUsers(
            db,
            [task.evaluator_user_id],
            'polyvalence_due_reminder',
            {
                department: task.department_name,
                periodName: task.period_name,
                daysLeft,
                dueText: daysLeft === 0 ? 'son gün' : `${daysLeft} gün kaldı`
            },
            { tag: `polyvalence-task-${task.id}-${notificationKey}` }
        );
        results.push({ task_id: task.id, days_left: daysLeft, ...result });
    }
    return { skipped: false, date, results };
};

const acquireSchedulerLease = async (db, ownerId) => {
    const lockDate = new Date(Date.now() + 55 * 1000);
    const lockUntil = process.env.DB_TYPE === 'postgres'
        ? lockDate
        : lockDate.toISOString().replace('T', ' ').replace('Z', '');
    const updated = await db.run(
        `UPDATE scheduler_locks
         SET owner_id = ?, lock_until = ?, updated_at = CURRENT_TIMESTAMP
         WHERE lock_name = ? AND (lock_until <= CURRENT_TIMESTAMP OR owner_id = ?)`,
        [ownerId, lockUntil, 'notification_scheduler', ownerId]
    );
    if (updated.changes > 0) return true;
    try {
        await db.run(
            'INSERT INTO scheduler_locks (lock_name, owner_id, lock_until) VALUES (?, ?, ?)',
            ['notification_scheduler', ownerId, lockUntil]
        );
        return true;
    } catch {
        return false;
    }
};

const startMoodReminderScheduler = (db) => {
    const ownerId = crypto.randomUUID();
    const timer = setInterval(async () => {
        try {
            if (!(await acquireSchedulerLease(db, ownerId))) return;
            const jobs = [
                ['notification routines', sendDueNotificationRoutines],
                ['birthday notifications', sendBirthdayNotificationsIfDue],
                ['history today', db => sendDailyContentIfDue(db, 'history_today')],
                ['daily quote', db => sendDailyContentIfDue(db, 'quote_daily')],
                ['polyvalence reminders', sendDuePolyvalenceReminders]
            ];
            const results = await Promise.allSettled(jobs.map(([, job]) => job(db)));
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`${jobs[index][0]} scheduler error:`, result.reason?.message || result.reason);
                }
            });
        } catch (err) {
            console.error('Mood reminder scheduler error:', err.message);
        }
    }, 60 * 1000);
    return () => clearInterval(timer);
};

module.exports = {
    sendMoodReminderIfDue,
    sendBirthdayNotificationsIfDue,
    sendDueNotificationRoutines,
    sendDuePolyvalenceReminders,
    sendRoutine,
    startMoodReminderScheduler
};
