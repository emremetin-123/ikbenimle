const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const {
    idParamsSchema,
    listQuerySchema,
    routineSchema,
    sendSchema,
    settingsSchema,
    subscriptionSchema,
    subscriptionListQuerySchema,
    templateListQuerySchema,
    templateParamsSchema,
    templatePatchSchema,
    unsubscribeSchema
} = require('../modules/notifications/notificationSchemas');
const {
    createNotificationRepository
} = require('../modules/notifications/notificationRepository');
const {
    createNotificationService
} = require('../modules/notifications/notificationService');
const {
    createNotificationController
} = require('../modules/notifications/notificationController');

module.exports = db => {
    const router = express.Router();
    const controller = createNotificationController(
        createNotificationService(db, createNotificationRepository(db))
    );
    const handle = method => asyncHandler(controller[method]);

    router.use(authenticateToken);
    router.get('/vapid-public-key', handle('vapidConfig'));
    router.post('/subscribe', validate({ body: subscriptionSchema }), handle('subscribe'));
    router.post(
        '/unsubscribe',
        validate({ body: unsubscribeSchema }),
        handle('unsubscribe')
    );
    router.post('/test-me', handle('testUser'));

    router.use('/admin', requirePermission('manage_notifications'));
    router.get('/admin/stats', handle('stats'));
    router.get('/admin/subscriptions', validate({ query: subscriptionListQuerySchema }), handle('listSubscriptions'));
    router.post('/admin/send', validate({ body: sendSchema }), handle('send'));
    router.post('/admin/send-mood-reminder', handle('sendMoodReminder'));
    router.post('/admin/send-birthday-now', handle('sendBirthday'));
    router.get(
        '/admin/event-templates',
        validate({ query: templateListQuerySchema }),
        handle('listTemplates')
    );
    router.put(
        '/admin/event-templates/:key',
        validate({ params: templateParamsSchema, body: templatePatchSchema }),
        handle('updateTemplate')
    );
    router.get(
        '/admin/routines',
        validate({ query: listQuerySchema }),
        handle('listRoutines')
    );
    router.post(
        '/admin/routines',
        validate({ body: routineSchema }),
        handle('createRoutine')
    );
    router.put(
        '/admin/routines/:id',
        validate({ params: idParamsSchema, body: routineSchema }),
        handle('updateRoutine')
    );
    router.delete(
        '/admin/routines/:id',
        validate({ params: idParamsSchema }),
        handle('deleteRoutine')
    );
    router.post(
        '/admin/routines/:id/send-now',
        validate({ params: idParamsSchema }),
        handle('sendRoutine')
    );
    router.get('/admin/settings', handle('getSettings'));
    router.put(
        '/admin/settings',
        validate({ body: settingsSchema }),
        handle('updateSettings')
    );
    return router;
};
