const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const {
    newsUpload,
    uploadToCloudinary,
    deleteFromCloudinary,
    useCloudinary,
    verifyUploadSignatures
} = require('../config/multer');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const {
    idParamsSchema,
    newsBodySchema,
    newsListQuerySchema
} = require('../modules/news/newsSchemas');
const { createNewsRepository } = require('../modules/news/newsRepository');
const { createNewsService } = require('../modules/news/newsService');
const { createNewsController } = require('../modules/news/newsController');

module.exports = (db) => {
    const router = express.Router();
    const manageNews = requirePermission('manage_news');
    const controller = createNewsController(createNewsService(
        createNewsRepository(db),
        { uploadToCloudinary, deleteFromCloudinary, useCloudinary }
    ));
    const authorizeAdminMount = (req, res, next) => (
        req.baseUrl.includes('/admin/') ? manageNews(req, res, next) : next()
    );

    router.use(authenticateToken);
    router.get(
        '/',
        authorizeAdminMount,
        validate({ query: newsListQuerySchema }),
        asyncHandler(controller.list)
    );
    router.get('/home-preview', authorizeAdminMount, asyncHandler(controller.homePreview));
    router.get(
        '/:id',
        validate({ params: idParamsSchema }),
        asyncHandler(controller.get)
    );
    router.post(
        '/',
        manageNews,
        newsUpload.single('image'),
        verifyUploadSignatures,
        validate({ body: newsBodySchema }),
        asyncHandler(controller.create)
    );
    router.delete(
        '/:id',
        manageNews,
        validate({ params: idParamsSchema }),
        asyncHandler(controller.remove)
    );

    return router;
};
