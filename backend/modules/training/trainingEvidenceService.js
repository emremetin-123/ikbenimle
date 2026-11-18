const { normalizeText } = require('../../services/trainingDocumentService');
const { createTrainingRepository } = require('./trainingRepository');

const buildAssignmentSnapshot = async (db, videoId) => {
    const repository = createTrainingRepository(db);
    const video = await repository.findVideo(videoId);
    const lessons = await repository.listSnapshotLessons(videoId);
    const modules = await repository.listModules(videoId);
    return {
        video,
        lessons,
        snapshot: JSON.stringify({
            video: {
                id: video.id,
                title: video.title,
                category: video.category,
                pass_score: video.pass_score,
                version_no: video.version_no,
                parent_video_id: video.parent_video_id,
                training_profile: video.training_profile,
                delivery_method: video.delivery_method,
                is_mandatory: video.is_mandatory,
                minimum_watch_percent: video.minimum_watch_percent,
                requires_full_watch: video.requires_full_watch,
                requires_quiz: video.requires_quiz,
                certificate_enabled: video.certificate_enabled,
                official_documents_enabled: video.official_documents_enabled
            },
            lessons,
            modules
        })
    };
};

const resolveLatestVideoId = async (db, videoId) => {
    const repository = createTrainingRepository(db);
    const selected = await repository.findSelectedVersion(videoId);
    if (!selected) return null;
    const rootId = selected.parent_video_id || selected.id;
    const latest = await repository.findLatestVersion(rootId);
    return latest?.id || selected.id;
};

const sendPdf = (res, buffer, fileName) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${normalizeText(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_')}"`
    );
    res.send(buffer);
};

const loadTrainingEvidence = async (db, assignmentId) => {
    const repository = createTrainingRepository(db);
    const assignment = await repository.findTrainingEvidenceAssignment(assignmentId);
    if (!assignment) return null;
    const [lessons, attempts, logs, files] = await Promise.all([
        repository.listTrainingEvidenceLessons(assignment.id, assignment.video_id),
        repository.listTrainingAttempts(assignment.id),
        repository.listTrainingLogs(assignment.id),
        repository.listTrainingFiles(assignment.id)
    ]);
    return { assignment, lessons, attempts, logs, files };
};

module.exports = {
    buildAssignmentSnapshot,
    resolveLatestVideoId,
    sendPdf,
    loadTrainingEvidence
};
