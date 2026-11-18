const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../core/http');
const { validate } = require('../core/validation');
const { createReminderRepository } = require('../modules/reminders/reminderRepository');
const { createReminderService } = require('../modules/reminders/reminderService');
const { createReminderController } = require('../modules/reminders/reminderController');
const {
    idParamsSchema,
    reminderCreateSchema,
    reminderUpdateSchema
} = require('../modules/reminders/reminderSchemas');

module.exports = db => {
    const router = express.Router();
    const controller = createReminderController(
        createReminderService(createReminderRepository(db))
    );

    router.use(authenticateToken);
    router.get('/', asyncHandler(controller.list));
    router.post(
        '/',
        validate({ body: reminderCreateSchema }),
        asyncHandler(controller.create)
    );
    router.put(
        '/:id',
        validate({ params: idParamsSchema, body: reminderUpdateSchema }),
        asyncHandler(controller.update)
    );
    router.delete(
        '/:id',
        validate({ params: idParamsSchema }),
        asyncHandler(controller.remove)
    );

    return router;
};
