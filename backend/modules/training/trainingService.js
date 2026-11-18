const contentService = require('./trainingContentService');
const uploadService = require('./trainingUploadService');
const evidenceService = require('./trainingEvidenceService');

module.exports = {
    ...contentService,
    resolveTrainingCoverImage: uploadService.resolveTrainingCoverImage,
    resolveTrainingBadgeImage: uploadService.resolveTrainingBadgeImage,
    validateTrainingBadge: uploadService.validateTrainingBadge,
    cleanupLocalTrainingUploads: uploadService.cleanupLocalTrainingUploads,
    getCloudinaryPublicIdFromUrl: uploadService.getCloudinaryPublicIdFromUrl,
    ...evidenceService
};
