const {
    buildAssignmentSnapshot,
    resolveLatestVideoId
} = require('./trainingService');
const { createTrainingRepository } = require('./trainingRepository');

const assignTrainingUsers = async (db, { userIds, videoId, dueDate }) => {
    const repository = createTrainingRepository(db);
    const selectedVideoId = Number(videoId);
    const resolvedVideoId = await resolveLatestVideoId(db, selectedVideoId);
    if (!resolvedVideoId) return null;
    const { video, snapshot } = await buildAssignmentSnapshot(db, resolvedVideoId);
    const trainingRootId = Number(video.parent_video_id || video.id);
    const uniqueUserIds = [...new Set(userIds.map(Number).filter(Boolean))];
    const result = await repository.withTransaction(async transactionRepository => {
        const created = [];
        const skipped = [];
        for (const userId of uniqueUserIds) {
            const inserted = await transactionRepository.createAssignment({
                userId,
                videoId: resolvedVideoId,
                trainingRootId,
                dueDate: dueDate || null,
                versionNo: Number(video.version_no || 1),
                snapshot,
                expiresAt: dueDate || null
            });
            (inserted.changes ? created : skipped).push(userId);
        }
        return { created, skipped };
    });
    return { ...result, video, videoId: resolvedVideoId, trainingRootId };
};

module.exports = { assignTrainingUsers };
