const { AppError } = require('../../core/http');

const DECISIONS = ['approved', 'rejected', 'needs_revision', 'deferred'];
const LEGACY_REVIEW_STAGES = ['waiting_opinion', 'in_progress', 'approved'];
const isClosed = status => ['resolved', 'completed', 'rejected'].includes(status);
const startsReview = status => status === 'assigned' || LEGACY_REVIEW_STAGES.includes(status);
const assertOpen = feedback => {
    if (isClosed(feedback.status)) {
        throw new AppError(409, 'FEEDBACK_CLOSED', 'Bu kayıt kapalı. İşlem yapmak için yönetici kaydı yeniden açmalıdır.');
    }
};
// Private decision text must never leave the management API, even in list responses.
const employeeView = feedback => {
    const { decision_note, ...visible } = feedback;
    return visible;
};

module.exports = { DECISIONS, LEGACY_REVIEW_STAGES, assertOpen, employeeView, isClosed, startsReview };
