const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const {
    feedbackUpload,
    feedbackCommentUpload,
    verifyUploadSignatures
} = require('../config/multer');
const { generateGeminiText } = require('../services/geminiTextService');
const {
    createFeedbackServiceForDb
} = require('../modules/feedback/feedbackService');
const {
    createFeedbackController
} = require('../modules/feedback/feedbackController');
const { validate } = require('../core/validation');
const { AppError } = require('../core/http');
const {
    assignmentBodySchema,
    commentAttachmentParamsSchema,
    commentBodySchema,
    decisionBodySchema,
    employeeFeedbackBodySchema,
    feedbackListQuerySchema,
    idParamsSchema,
    improveTextBodySchema,
    multipartCommentBodySchema,
    optionListQuerySchema,
    participantsBodySchema,
    statusBodySchema,
    suggestionBodySchema
} = require('../modules/feedback/feedbackSchemas');

const parseCommentFile = feedbackCommentUpload.single('file');
const validateJsonComment = validate({ body: commentBodySchema });
const validateMultipartComment = validate({ body: multipartCommentBodySchema });
const validateComment = (req, res, next) => {
    if (!req.is('multipart/form-data')) return validateJsonComment(req, res, next);
    parseCommentFile(req, res, error => {
        if (error) return next(new AppError(400, 'FEEDBACK_ATTACHMENT_INVALID', error.code === 'LIMIT_FILE_SIZE'
            ? 'Ek dosya en fazla 10 MB olabilir.' : 'Yalnızca bir PDF veya görsel ekleyebilirsiniz.'));
        verifyUploadSignatures(req, res, err => {
            if (err) return next(new AppError(400, 'FEEDBACK_ATTACHMENT_INVALID', err.message));
            validateMultipartComment(req, res, next);
        });
    });
};

const createContext = db => {
    const service = createFeedbackServiceForDb(db, {
        generateText: prompt => generateGeminiText(db, prompt)
    });
    return createFeedbackController(service);
};

const createEmployeeFeedbackRouter = db => {
    const router = express.Router();
    const controller = createContext(db);

    router.post(
        '/improve-text',
        authenticateToken,
        validate({ body: improveTextBodySchema }),
        controller.improveText
    );
    router.get('/mine', authenticateToken, controller.mine);
    router.get('/participating', authenticateToken, controller.participating);
    router.get(
        '/:id/detail',
        authenticateToken,
        validate({ params: idParamsSchema }),
        controller.detail
    );
    router.get(
        '/:id/thread',
        authenticateToken,
        validate({ params: idParamsSchema }),
        controller.userThread
    );
    router.post(
        '/:id/review-completion',
        authenticateToken,
        validate({ params: idParamsSchema }),
        controller.completeReview
    );
    router.post(
        '/:id/comments',
        authenticateToken,
        validate({ params: idParamsSchema }),
        controller.authorizeUserCommentUpload,
        validateComment,
        controller.addUserComment
    );
    router.get('/:id/comments/:commentId/attachment', authenticateToken,
        validate({ params: commentAttachmentParamsSchema }), controller.downloadCommentAttachment(false));
    router.get('/:id/participant-options', authenticateToken,
        validate({ params: idParamsSchema, query: optionListQuerySchema }), controller.participantOptions);
    router.post('/:id/participants', authenticateToken,
        validate({ params: idParamsSchema, body: participantsBodySchema }), controller.addAssignedParticipants);
    router.post(
        '/',
        authenticateToken,
        validate({ body: employeeFeedbackBodySchema }),
        controller.create
    );
    router.post(
        '/suggestion',
        authenticateToken,
        feedbackUpload.single('file'),
        verifyUploadSignatures,
        validate({ body: suggestionBodySchema }),
        controller.createSuggestion
    );

    return router;
};

const createAdminFeedbackRouter = db => {
    const router = express.Router();
    const controller = createContext(db);

    router.get(
        '/user-options',
        authenticateToken,
        requirePermission('manage_feedback'),
        validate({ query: optionListQuerySchema }),
        controller.userOptions
    );
    router.get(
        '/',
        authenticateToken,
        requirePermission('manage_feedback'),
        validate({ query: feedbackListQuerySchema }),
        controller.listAdmin
    );
    router.get(
        '/:id/thread',
        authenticateToken,
        requirePermission('manage_feedback'),
        validate({ params: idParamsSchema }),
        controller.adminThread
    );
    router.get('/:id/detail', authenticateToken, requirePermission('manage_feedback'),
        validate({ params: idParamsSchema }), controller.adminDetail);
    router.put(
        '/:id/assignment',
        authenticateToken,
        requirePermission('manage_feedback'),
        validate({ params: idParamsSchema, body: assignmentBodySchema }),
        controller.assign
    );
    router.post(
        '/:id/participants',
        authenticateToken,
        requirePermission('manage_feedback'),
        validate({ params: idParamsSchema, body: participantsBodySchema }),
        controller.addParticipants
    );
    router.post(
        '/:id/comments',
        authenticateToken,
        requirePermission('manage_feedback'),
        validate({ params: idParamsSchema }),
        validateComment,
        controller.addAdminComment
    );
    router.get('/:id/comments/:commentId/attachment', authenticateToken, requirePermission('manage_feedback'),
        validate({ params: commentAttachmentParamsSchema }), controller.downloadCommentAttachment(true));
    router.put(
        '/:id/decision',
        authenticateToken,
        requirePermission('manage_feedback'),
        validate({ params: idParamsSchema, body: decisionBodySchema }),
        controller.decide
    );
    router.put(
        '/:id/status',
        authenticateToken,
        requirePermission('manage_feedback'),
        validate({ params: idParamsSchema, body: statusBodySchema }),
        controller.updateStatus
    );
    return router;
};

module.exports = {
    createAdminFeedbackRouter,
    createEmployeeFeedbackRouter
};
