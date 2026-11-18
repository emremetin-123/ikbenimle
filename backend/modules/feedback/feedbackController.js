const { AppError, asyncHandler } = require('../../core/http');
const { root: attachmentRoot } = require('./feedbackAttachments');

const createFeedbackController = (service) => ({
    listAdmin: asyncHandler(async (req, res) => {
        res.json(await service.listAdmin(req.query));
    }),
    userOptions: asyncHandler(async (req, res) => {
        res.json(await service.listUserOptions(req.query));
    }),
    participantOptions: asyncHandler(async (req, res) => {
        res.json(await service.listParticipantOptions(req.params.id, req.user, req.query));
    }),
    addAssignedParticipants: asyncHandler(async (req, res) => {
        await service.addAssignedParticipants(req.params.id, req.body.user_ids, req.user.id);
        res.json({ success: true });
    }),
    improveText: asyncHandler(async (req, res) => {
        res.json({ improvedText: await service.improveText(req.body) });
    }),
    mine: asyncHandler(async (req, res) => {
        res.json(await service.listMine(req.user.id));
    }),
    participating: asyncHandler(async (req, res) => {
        res.json(await service.listParticipating(req.user.id));
    }),
    detail: asyncHandler(async (req, res) => {
        res.json(await service.getDetail(req.params.id, req.user));
    }),
    userThread: asyncHandler(async (req, res) => {
        res.json(await service.getUserThread(req.params.id, req.user));
    }),
    adminThread: asyncHandler(async (req, res) => {
        res.json(await service.getAdminThread(req.params.id));
    }),
    adminDetail: asyncHandler(async (req, res) => {
        const item = await service.getAdminDetail(req.params.id);
        res.json(item);
    }),
    authorizeUserCommentUpload: asyncHandler(async (req, _res, next) => {
        if (req.is('multipart/form-data')) await service.assertUserCanComment(req.params.id, req.user);
        next();
    }),
    addUserComment: asyncHandler(async (req, res) => {
        await service.addUserComment(req.params.id, req.user, req.body, req.file);
        res.json({ success: true });
    }),
    addAdminComment: asyncHandler(async (req, res) => {
        await service.addAdminComment(req.params.id, req.user.id, req.body, req.file);
        res.json({ success: true });
    }),
    downloadCommentAttachment: admin => asyncHandler(async (req, res, next) => {
        const { attachment_key, attachment_name } = await service.getCommentAttachment(req.params.id, req.params.commentId, req.user, admin);
        res.download(attachment_key, attachment_name, {
            root: attachmentRoot,
            dotfiles: 'deny',
            headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
        }, error => {
            if (error?.status === 404 && !res.headersSent) return next(new AppError(404, 'FILE_NOT_FOUND', 'Ek dosya bulunamadı.'));
            if (error) next(error);
        });
    }),
    completeReview: asyncHandler(async (req, res) => {
        await service.completeReview(req.params.id, req.user);
        res.json({ success: true });
    }),
    create: asyncHandler(async (req, res) => {
        await service.create(req.body, req.user.id);
        res.json({ success: true });
    }),
    createSuggestion: asyncHandler(async (req, res) => {
        await service.create(req.body, req.user.id, {
            file: req.file,
            suggestion: true
        });
        res.json({ success: true });
    }),
    assign: asyncHandler(async (req, res) => {
        await service.assign(req.params.id, req.body, req.user.id);
        res.json({ success: true });
    }),
    addParticipants: asyncHandler(async (req, res) => {
        await service.addParticipants(
            req.params.id,
            req.body.user_ids,
            req.user.id
        );
        res.json({ success: true });
    }),
    decide: asyncHandler(async (req, res) => {
        await service.decide(req.params.id, req.body, req.user.id);
        res.json({ success: true });
    }),
    updateStatus: asyncHandler(async (req, res) => {
        await service.updateStatus(req.params.id, req.body.status, req.user.id);
        res.json({ success: true });
    })
});

module.exports = {
    createFeedbackController
};
