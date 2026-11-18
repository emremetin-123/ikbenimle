const express = require('express');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { validate } = require('../../core/validation');
const {
    upload,
    deleteFromCloudinary,
    useCloudinary,
    verifyUploadSignatures
} = require('../../config/multer');
const {
    buildTrainingSettings,
    parseTrainingContents,
    validateLessonsPayload,
    resolveTrainingCoverImage,
    resolveTrainingBadgeImage,
    validateTrainingBadge,
    cleanupLocalTrainingUploads
} = require('./trainingService');
const {
    idParamsSchema,
    trainingCreateBodySchema,
    trainingUpdateBodySchema
} = require('./trainingSchemas');
const { createAdminTrainingMutationRepository } = require('./adminTrainingMutationRepository');
const { createAdminTrainingMutationService } = require('./adminTrainingMutationService');

module.exports = function createAdminTrainingMutationRoutes(db) {
    const router = express.Router();
    const service = createAdminTrainingMutationService(createAdminTrainingMutationRepository(db));

    // Video ekle
    router.post('/video', authenticateToken, requirePermission('manage_education'), upload.any(), verifyUploadSignatures, validate({ body: trainingCreateBodySchema }), async (req, res) => {
        const { title, description, category, pass_score, awards_badge, certificate_enabled,
            auto_reassign_enabled, validity_amount, validity_unit, pause_on_blur, disable_forward_seek,
            track_watch_seconds, quiz_attempt_limit, trainer_name, trainer_title, duration, validity_period } = req.body;
        const trainingSettings = buildTrainingSettings(req.body);
        const lessons = parseTrainingContents(req.body);
        if (!lessons) {
            await cleanupLocalTrainingUploads(req.files);
            return res.status(400).json({ error: 'Invalid lessons data' });
        }

        const uploadedFiles = [];

        try {
            const validationError = validateLessonsPayload(lessons, req.files)
                || validateTrainingBadge(req.body, req.files);
            if (validationError) {
                await cleanupLocalTrainingUploads(req.files);
                return res.status(400).json({ error: validationError });
            }
            trainingSettings.cover_image_url = await resolveTrainingCoverImage(
                req.files,
                trainingSettings.cover_image_url,
                uploadedFiles
            );
            const badgeImageUrl = await resolveTrainingBadgeImage(req.files, '', uploadedFiles);

            const videoId = await service.createVideo(
                    [
                        title,
                        description,
                        category,
                        pass_score || 0,
                        trainer_name,
                        trainer_title,
                        duration,
                        validity_period,
                        [false, 0, '0', 'false'].includes(awards_badge) ? 0 : 1,
                        certificate_enabled === 'false' ? 0 : 1,
                        auto_reassign_enabled === 'true' ? 1 : 0,
                        Number(validity_amount) || null,
                        validity_unit || null,
                        pause_on_blur === 'true' ? 1 : 0,
                        disable_forward_seek === 'true' ? 1 : 0,
                        track_watch_seconds === 'true' ? 1 : 0,
                        Number(quiz_attempt_limit) || 0,
                        trainingSettings.training_profile,
                        trainingSettings.delivery_method,
                        trainingSettings.is_mandatory,
                        trainingSettings.compliance_lock,
                        1,
                        1,
                        1,
                        trainingSettings.minimum_watch_percent,
                        trainingSettings.requires_full_watch,
                        trainingSettings.requires_quiz,
                        trainingSettings.official_documents_enabled,
                        trainingSettings.detailed_audit_enabled,
                        trainingSettings.cover_image_url,
                        badgeImageUrl
                    ],
                    lessons,
                    req.files,
                    uploadedFiles
                );
            res.json({ success: true, videoId });
        } catch (err) {
            await cleanupLocalTrainingUploads(req.files);
            if (useCloudinary) {
                await Promise.all(uploadedFiles.map(file =>
                    deleteFromCloudinary(file.public_id, { resource_type: file.resource_type })
                ));
            }
            console.error('Admin video creation error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    // Video bilgilerini guncelle
    router.put('/video/:id', authenticateToken, requirePermission('manage_education'), upload.any(), verifyUploadSignatures, validate({ params: idParamsSchema, body: trainingUpdateBodySchema }), async (req, res) => {
        const { id } = req.params;
        const {
            title,
            description,
            category,
            pass_score,
            trainer_name,
            trainer_title,
            duration,
            validity_period,
            awards_badge,
            certificate_enabled,
            auto_reassign_enabled,
            validity_amount,
            validity_unit,
            pause_on_blur,
            disable_forward_seek,
            track_watch_seconds,
            quiz_attempt_limit
        } = req.body;
        const trainingSettings = buildTrainingSettings(req.body);
        const uploadedFiles = [];

        if (!title?.trim()) {
            return res.status(400).json({ error: 'Egitim basligi zorunludur' });
        }

        try {
            const updateContext = await service.findVideoForUpdate(id);
            if (!updateContext) {
                return res.status(404).json({ error: 'Egitim bulunamadi' });
            }
            const { original, hasHistory } = updateContext;
            const submittedLessons = parseTrainingContents(req.body);
            if (!submittedLessons) {
                await cleanupLocalTrainingUploads(req.files);
                return res.status(400).json({ error: 'Invalid lessons data' });
            }
            const lessonsForSave = submittedLessons;
            const validationError = validateLessonsPayload(lessonsForSave, req.files)
                || validateTrainingBadge(req.body, req.files, original);
            if (validationError) {
                await cleanupLocalTrainingUploads(req.files);
                return res.status(400).json({ error: validationError });
            }
            const removeCoverImage = req.body.remove_cover_image === true
                || req.body.remove_cover_image === 1
                || req.body.remove_cover_image === '1'
                || req.body.remove_cover_image === 'true';
            const coverFallback = removeCoverImage ? '' : original.cover_image_url;
            trainingSettings.cover_image_url = await resolveTrainingCoverImage(
                req.files,
                coverFallback,
                uploadedFiles
            );
            const removeBadgeImage = [true, 1, '1', 'true'].includes(req.body.remove_badge_image);
            const badgeImageUrl = await resolveTrainingBadgeImage(
                req.files, removeBadgeImage ? '' : original.badge_image_url, uploadedFiles
            );
            const videoValues = [
                title.trim(),
                description || '',
                category || '',
                Number(pass_score) || 0,
                trainer_name || '',
                trainer_title || '',
                duration || '',
                validity_period || '',
                [false, 0, '0', 'false'].includes(awards_badge) ? 0 : 1,
                certificate_enabled === false || certificate_enabled === 0 || certificate_enabled === 'false' ? 0 : 1,
                auto_reassign_enabled === true || auto_reassign_enabled === 1 || auto_reassign_enabled === 'true' ? 1 : 0,
                Number(validity_amount) || null,
                validity_unit || null,
                pause_on_blur === true || pause_on_blur === 1 || pause_on_blur === 'true' ? 1 : 0,
                disable_forward_seek === true || disable_forward_seek === 1 || disable_forward_seek === 'true' ? 1 : 0,
                track_watch_seconds === true || track_watch_seconds === 1 || track_watch_seconds === 'true' ? 1 : 0,
                Number(quiz_attempt_limit) || 0,
                trainingSettings.training_profile,
                trainingSettings.delivery_method,
                trainingSettings.is_mandatory,
                trainingSettings.compliance_lock,
                trainingSettings.minimum_watch_percent,
                trainingSettings.requires_full_watch,
                trainingSettings.requires_quiz,
                trainingSettings.official_documents_enabled,
                trainingSettings.detailed_audit_enabled,
                trainingSettings.cover_image_url,
                badgeImageUrl
            ];

            if (!hasHistory) {
                return res.json(await service.updateVideo(
                    id, videoValues, lessonsForSave, req.files, uploadedFiles
                ));
            }
            res.json(await service.createVersion(
                original, videoValues, lessonsForSave, req.files, uploadedFiles
            ));
        } catch (err) {
            await cleanupLocalTrainingUploads(req.files);
            if (useCloudinary) {
                await Promise.all(uploadedFiles.map(file =>
                    deleteFromCloudinary(file.public_id, { resource_type: file.resource_type })
                ));
            }
            console.error('Update video error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    // Video sil
    router.delete('/video/:id', authenticateToken, requirePermission('manage_education'), validate({ params: idParamsSchema }), async (req, res) => {
        const { id } = req.params;
        try {
            res.json(await service.deleteVideo(id));
        } catch (err) {
            console.error('Delete video error:', err);
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });

    return router;
};
