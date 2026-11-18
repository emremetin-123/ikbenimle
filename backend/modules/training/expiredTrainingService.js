const addValidity = (dateValue, amount, unit) => {
    const amountNumber = Number(amount || 0);
    if (!dateValue || !amountNumber) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    if (unit === 'month') date.setMonth(date.getMonth() + amountNumber);
    else if (unit === 'year') date.setFullYear(date.getFullYear() + amountNumber);
    else date.setDate(date.getDate() + amountNumber);
    return date;
};

const createExpiredTrainingService = repository => ({
    async run(userId = null) {
        const rows = await repository.listExpiredCandidates(userId);
        const now = new Date();
        let created = 0;
        for (const row of rows) {
            const expiresAt = addValidity(
                row.completed_at,
                row.validity_amount,
                row.validity_unit || 'day'
            );
            if (!expiresAt || expiresAt > now) continue;

            const rootId = row.parent_video_id || row.video_id;
            const latest = await repository.findLatestActiveVersion(rootId);
            const nextVideo = latest || row;
            const nextVideoId = nextVideo.id || row.video_id;
            const [lessons, modules] = await Promise.all([
                repository.listSnapshotLessons(nextVideoId),
                repository.listModules(nextVideoId)
            ]);
            const snapshot = JSON.stringify({
                video: {
                    id: nextVideoId,
                    title: nextVideo.title,
                    category: nextVideo.category,
                    pass_score: nextVideo.pass_score,
                    version_no: nextVideo.version_no,
                    training_profile: nextVideo.training_profile,
                    delivery_method: nextVideo.delivery_method
                },
                lessons,
                modules
            });
            const inserted = await repository.createExpiredReassignment({
                userId: row.user_id,
                videoId: nextVideoId,
                trainingRootId: rootId,
                expiresAt: expiresAt.toISOString(),
                versionNo: Number(nextVideo.version_no || 1),
                snapshot,
                previousAssignmentId: row.id,
                completedAt: row.completed_at
            });
            created += Number(inserted.changes || 0);
        }
        return { scanned: rows.length, created };
    }
});

module.exports = { addValidity, createExpiredTrainingService };
