const fs = require('node:fs');
const { deleteFromCloudinary, useCloudinary } = require('../../config/multer');
const { resolveLocalPath } = require('../../services/uploadStorageService');
const { insertTrainingLessons } = require('./trainingContentService');
const { getCloudinaryPublicIdFromUrl } = require('./trainingUploadService');

const createAdminTrainingMutationService = repository => ({
    createVideo(values, lessons, files, uploadedFiles) {
        return repository.withTransaction(async (transactionRepository, tx) => {
            const result = await transactionRepository.createVideo(values);
            await insertTrainingLessons(tx, result.lastID, lessons, files, uploadedFiles);
            return result.lastID;
        });
    },

    async findVideoForUpdate(videoId) {
        const original = await repository.findVideo(videoId);
        if (!original) return null;
        const assignmentCount = await repository.countActiveAssignments(videoId);
        return { original, hasHistory: Number(assignmentCount?.count || 0) > 0 };
    },

    updateVideo(videoId, values, lessons, files, uploadedFiles) {
        return repository.withTransaction(async (transactionRepository, tx) => {
            await transactionRepository.updateVideo(videoId, values);
            await transactionRepository.deleteVideoContents(videoId);
            await insertTrainingLessons(tx, videoId, lessons, files, uploadedFiles);
            return { success: true, newVersion: false };
        });
    },

    async createVersion(original, values, lessons, files, uploadedFiles) {
        const rootId = original.parent_video_id || original.id;
        const versionInfo = await repository.getMaxVersion(rootId);
        const nextVersion = Number(versionInfo?.max_version || original.version_no || 1) + 1;
        const videoId = await repository.withTransaction(async (transactionRepository, tx) => {
            await transactionRepository.markVersionsNotLatest(rootId);
            const result = await transactionRepository.createVersion(values, nextVersion, rootId);
            await insertTrainingLessons(tx, result.lastID, lessons, files, uploadedFiles);
            return result.lastID;
        });
        return { success: true, newVersion: true, videoId, version_no: nextVersion };
    },

    async deleteVideo(videoId) {
        const assignmentCount = await repository.countAssignments(videoId);
        if (Number(assignmentCount?.count || 0) > 0) {
            await repository.archiveVideo(videoId);
            return { success: true, archived: true };
        }
        const lessons = await repository.listLessonFiles(videoId);
        for (const lesson of lessons) {
            if (useCloudinary && lesson.url?.startsWith('http')) {
                const publicId = getCloudinaryPublicIdFromUrl(lesson.url);
                if (publicId) await deleteFromCloudinary(publicId, { resource_type: 'video' });
            } else if (lesson.url?.startsWith('/uploads')) {
                const filePath = resolveLocalPath(lesson.url);
                if (filePath) {
                    await fs.promises.unlink(filePath).catch(error => {
                        if (error.code !== 'ENOENT') throw error;
                    });
                }
            }
        }
        await repository.withTransaction(transactionRepository => transactionRepository.deleteVideo(videoId));
        return { success: true };
    }
});

module.exports = { createAdminTrainingMutationService };
