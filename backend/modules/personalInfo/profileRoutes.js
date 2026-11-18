const routerFactory = require('express').Router;
const { authenticateToken } = require('../../middleware/auth');
const {
    avatarUpload,
    verifyUploadSignatures
} = require('../../config/multer');
const { validate } = require('../../core/validation');
const { asyncHandler, AppError } = require('../../core/http');
const {
    profileUpdateSchema,
    createProfileService
} = require('./profileService');
const { createProfileRepository } = require('./profileRepository');
const { createProfilePhotoService } = require('./profilePhotoService');

module.exports = (db) => {
    const router = routerFactory();
    const repository = createProfileRepository(db);
    const service = createProfileService(repository);
    const photoService = createProfilePhotoService(repository);
    // Kişisel bilgi getir
    router.get('/', authenticateToken, asyncHandler(async (req, res) => {
        const profile = await service.getProfile(req.user.id);
        if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profil bulunamadı.');
        res.json(profile);
    }));

    // Kişisel bilgi g?ncelle
    router.put(
        '/',
        authenticateToken,
        validate({ body: profileUpdateSchema }),
        asyncHandler(async (req, res) => {
            const profile = await service.updateProfile(req.user.id, req.body);
            res.json({ success: true, profile });
        })
    );

    router.post(
        '/photo',
        authenticateToken,
        avatarUpload.single('photo'),
        verifyUploadSignatures,
        asyncHandler(async (req, res) => {
            if (!req.file) {
                throw new AppError(400, 'PHOTO_REQUIRED', 'Profil fotoğrafı yüklenmedi.');
            }

            const photoPath = await photoService.replacePhoto(req.user.id, req.file);
            res.json({ success: true, photo_path: photoPath });
        })
    );

    return router;
};
