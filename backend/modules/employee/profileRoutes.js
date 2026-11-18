const routerFactory = require('express').Router;
const { authenticateToken } = require('../../middleware/auth');
const { validate } = require('../../core/validation');
const { asyncHandler, AppError } = require('../../core/http');
const {
    profileUpdateSchema,
    getProfile,
    updateProfile
} = require('../personalInfo/profileService');

module.exports = (db) => {
    const router = routerFactory();

    router.get('/user/profile', authenticateToken, asyncHandler(async (req, res) => {
        const profile = await getProfile(db, req.user.id);
        if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profil bulunamadı.');
        res.json(profile);
    }));

    router.put(
        '/user/profile',
        authenticateToken,
        validate({ body: profileUpdateSchema }),
        asyncHandler(async (req, res) => {
            const updatedProfile = await updateProfile(db, req.user.id, req.body);
            res.json({ success: true, profile: updatedProfile });
        })
    );

    return router;
};
