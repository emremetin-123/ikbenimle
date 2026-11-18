const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const pushService = require('../services/pushNotificationService');
const {
    announcementUpload,
    uploadToCloudinary,
    deleteFromCloudinary,
    useCloudinary,
    verifyUploadSignatures
} = require('../config/multer');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const {
    announcementBodySchema,
    announcementListQuerySchema,
    idParamsSchema
} = require('../modules/announcements/announcementSchemas');
const {
    createAnnouncementRepository
} = require('../modules/announcements/announcementRepository');
const { createAnnouncementService } = require('../modules/announcements/announcementService');
const {
    createAnnouncementController
} = require('../modules/announcements/announcementController');

module.exports = (db) => {
    const router = express.Router();
    const manageAnnouncements = requirePermission('manage_announcements');
    const controller = createAnnouncementController(createAnnouncementService(
        createAnnouncementRepository(db),
        {
            db,
            pushService,
            media: { uploadToCloudinary, deleteFromCloudinary, useCloudinary }
        }
    ));
    const authorizeAdminMount = (req, res, next) => (
        req.baseUrl.includes('/admin/')
            ? manageAnnouncements(req, res, next)
            : next()
    );

    router.use(authenticateToken);
    router.get(
        '/',
        authorizeAdminMount,
        validate({ query: announcementListQuerySchema }),
        asyncHandler(controller.list)
    );
    router.get('/home-preview', authorizeAdminMount, asyncHandler(controller.homePreview));
    router.get(
        '/departments',
        manageAnnouncements,
        asyncHandler(controller.listDepartments)
    );
    router.post(
        '/',
        manageAnnouncements,
        announcementUpload.single('attachment'),
        verifyUploadSignatures,
        validate({ body: announcementBodySchema }),
        asyncHandler(controller.create)
    );
    router.delete(
        '/:id',
        manageAnnouncements,
        validate({ params: idParamsSchema }),
        asyncHandler(controller.remove)
    );

    return router;
};
