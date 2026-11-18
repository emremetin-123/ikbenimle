const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const {
    birthdayListQuerySchema,
    directoryListQuerySchema,
    idParamsSchema
} = require('../modules/directory/directorySchemas');
const { createDirectoryRepository } = require('../modules/directory/directoryRepository');
const { createDirectoryService } = require('../modules/directory/directoryService');
const { createDirectoryController } = require('../modules/directory/directoryController');

module.exports = (db) => {
    const router = express.Router();
    const controller = createDirectoryController(
        createDirectoryService(createDirectoryRepository(db))
    );

    router.use(authenticateToken);
    router.get(
        '/',
        validate({ query: directoryListQuerySchema }),
        asyncHandler(controller.list)
    );
    router.get(
        '/birthdays/today',
        validate({ query: birthdayListQuerySchema }),
        asyncHandler(controller.listBirthdays)
    );
    router.get(
        '/:id',
        validate({ params: idParamsSchema }),
        asyncHandler(controller.getProfile)
    );

    return router;
};
