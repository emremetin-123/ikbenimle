const { subscriptionListQuerySchema } = require('./notificationSchemas');

function createNotificationController(service) {
    const success = handler => async (req, res) => {
        const result = await handler(req);
        res.json({ success: true, ...result });
    };
    return {
        vapidConfig: async (_req, res) => res.json(await service.vapidConfig()),
        subscribe: async (req, res) => {
            const id = await service.subscribe(req.user.id, req.body);
            res.json({ success: true, id });
        },
        unsubscribe: success(req => service.unsubscribe(req.user.id, req.body.endpoint)),
        testUser: success(req => service.testUser(req.user.id)),
        stats: async (_req, res) => res.json(await service.stats()),
        listSubscriptions: async (req, res) => {
            res.set('Cache-Control', 'no-store');
            res.json(await service.listSubscriptions(subscriptionListQuerySchema.parse(req.query)));
        },
        send: success(req => service.send(req.body)),
        sendMoodReminder: success(() => service.sendMoodReminder()),
        sendBirthday: success(() => service.sendBirthday()),
        listTemplates: async (req, res) => res.json(
            await service.listTemplates(req.query)
        ),
        updateTemplate: async (req, res) => {
            const template = await service.updateTemplate(req.params.key, req.body);
            res.json({ success: true, template });
        },
        listRoutines: async (req, res) => res.json(
            await service.listRoutines(req.query)
        ),
        createRoutine: async (req, res) => {
            const routine = await service.createRoutine(req.body, req.user.id);
            res.status(201).json({ success: true, routine });
        },
        updateRoutine: async (req, res) => {
            const routine = await service.updateRoutine(req.params.id, req.body);
            res.json({ success: true, routine });
        },
        deleteRoutine: success(req => service.deleteRoutine(req.params.id)),
        sendRoutine: success(req => service.sendRoutine(req.params.id)),
        getSettings: async (_req, res) => res.json(await service.getSettings()),
        updateSettings: success(req => service.updateSettings(req.body))
    };
}

module.exports = { createNotificationController };
