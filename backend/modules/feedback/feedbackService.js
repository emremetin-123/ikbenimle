const { parsePagination, paginatedResponse } = require('../../core/pagination');
const { AppError } = require('../../core/http');
const { createUploadStorageService } = require('../../services/uploadStorageService');
const { createFeedbackRepository } = require('./feedbackRepository');
const { assertOpen, employeeView, isClosed, startsReview } = require('./feedbackPolicy');
const { storeCommentAttachment, removeCommentAttachment } = require('./feedbackAttachments');

const text = (value, max = 255) => String(value || '').trim().slice(0, max);
const dateBoundary = (value, endOfDay = false) => {
    const normalized = text(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';
    if (!endOfDay) return `${normalized}T00:00:00`;
    const date = new Date(`${normalized}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 19);
};

const feedbackStorage = createUploadStorageService();
const storeFeedbackFile = file => feedbackStorage.store(file, 'feedback');
const isOwner = (feedback, user) => Number(feedback.user_id) === Number(user.id);
const isAssignee = (feedback, user) => Number(feedback.assigned_to_user_id) === Number(user.id);
const canInvite = (feedback, user) => isAssignee(feedback, user) && !isOwner(feedback, user);
const isTeamMember = async (repository, feedback, user) => !isOwner(feedback, user)
    && (isAssignee(feedback, user) || await repository.isParticipant(feedback.id, user.id));
const assertFeedbackExists = feedback => {
    if (!feedback) throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Kayıt bulunamadı.');
};
const assertCanInvite = (feedback, user) => {
    assertFeedbackExists(feedback);
    if (!canInvite(feedback, user)) {
        throw new AppError(403, 'FEEDBACK_PARTICIPANTS_DENIED', 'Yalnız atanan sorumlu katılımcı ekleyebilir.');
    }
    assertOpen(feedback);
};
const assertCanAccess = async (repository, feedback, user) => {
    assertFeedbackExists(feedback);
    const team = await isTeamMember(repository, feedback, user);
    if (user.role !== 'admin' && !isOwner(feedback, user) && !team) {
        throw new AppError(403, 'FEEDBACK_ACCESS_DENIED', 'Bu kayda erişim yetkiniz yok.');
    }
    return team;
};
const startReview = async (repository, feedback, userId, note) => {
    if (!startsReview(feedback.status)) return;
    await repository.updateStatus(feedback.id, 'in_review');
    if (feedback.status === 'assigned') {
        await repository.addHistory(feedback.id, userId, 'assigned', 'in_review', note);
    }
};

const createFeedbackService = (repository, dependencies = {}) => {
    const inTransaction = dependencies.transaction
        || (async work => work(repository));
    const removeStoredFile = dependencies.removeStoredFile
        || (stored => feedbackStorage.remove(stored));
    const addComment = async (id, user, body, file, admin = false) => {
        let attachment;
        try {
            await inTransaction(async txRepository => {
                const feedback = await txRepository.findForUpdate(id);
                assertFeedbackExists(feedback);
                const team = admin || await assertCanAccess(txRepository, feedback, user);
                assertOpen(feedback);
                if (file) attachment = await storeCommentAttachment(file);
                const isPublic = !team || body.is_public;
                await txRepository.addComment(id, user.id, body.comment, isPublic, attachment);
                await startReview(txRepository, feedback, isPublic ? user.id : null, 'İlk görüş eklendi');
            });
        } catch (error) {
            if (attachment) await removeCommentAttachment(attachment.key);
            throw error;
        }
    };
    const addParticipants = (id, userIds, addedBy, delegated = false) => inTransaction(async txRepository => {
        const feedback = await txRepository.findForUpdate(id);
        if (delegated) assertCanInvite(feedback, { id: addedBy });
        else {
            assertFeedbackExists(feedback);
            assertOpen(feedback);
        }
        const ids = delegated ? userIds.filter(userId => userId !== Number(feedback.user_id) && userId !== Number(addedBy)) : userIds;
        if (!await txRepository.validateUsers(ids)) {
            throw new AppError(400, 'FEEDBACK_INVALID_USER', 'Yalnız aktif kullanıcılar sürece eklenebilir.');
        }
        const added = await txRepository.addParticipants(id, ids, addedBy);
        if (delegated && added) await startReview(txRepository, feedback, addedBy, 'Sorumlu katılımcı ekledi');
    });

    return ({
    async listAdmin(query) {
        const pagination = parsePagination(query);
        const filters = {
            search: text(query.search),
            status: text(query.status, 50),
            type: text(query.type, 50),
            startDate: dateBoundary(query.start),
            endDate: dateBoundary(query.end, true),
            sort: ['created_at', 'status', 'type', 'due_date'].includes(query.sort)
                ? query.sort
                : 'created_at',
            order: query.order === 'asc' ? 'asc' : 'desc'
        };

        const result = await repository.listAdmin(filters, pagination);
        return paginatedResponse(result.items, result.total, pagination.page, pagination.pageSize);
    },
    async listUserOptions(query) {
        const pagination = parsePagination(query);
        const result = await repository.listUserOptions(pagination, text(query.search, 255));
        return paginatedResponse(
            result.items,
            result.total,
            pagination.page,
            pagination.pageSize
        );
    },
    listMine: async userId => (await repository.listMine(userId)).map(employeeView),
    listParticipating: async userId => (await repository.listParticipating(userId)).map(employeeView),
    async listParticipantOptions(id, user, query) {
        const feedback = await repository.find(id);
        assertCanInvite(feedback, user);
        const pagination = parsePagination(query);
        const { items, total } = await repository.listUserOptions(pagination, text(query.search), feedback);
        const options = items.map(({ id, name, employee_id, department }) => ({ id, name, employee_id, department }));
        return paginatedResponse(options, total, pagination.page, pagination.pageSize);
    },
    async getDetail(id, user) {
        const feedback = await repository.findDetail(id);
        const team = await assertCanAccess(repository, feedback, user);
        const owner = isOwner(feedback, user);
        const assignee = isAssignee(feedback, user);
        return {
            ...employeeView(feedback),
            viewer_role: owner ? 'owner' : assignee ? 'assignee' : 'participant',
            can_comment: !isClosed(feedback.status),
            can_internal_comment: team,
            can_complete_review: assignee && !owner && !isClosed(feedback.status),
            can_add_participants: canInvite(feedback, user) && !isClosed(feedback.status)
        };
    },
    async getUserThread(id, user) {
        const feedback = await repository.find(id);
        const team = await assertCanAccess(repository, feedback, user);
        return repository.getThread(id, user.id, team);
    },
    getAdminThread: id => repository.getThread(id),
    async getAdminDetail(id) {
        const feedback = await repository.findDetail(id);
        if (!feedback) throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Kayıt bulunamadı.');
        return feedback;
    },
    async assertUserCanComment(id, user) {
        const feedback = await repository.find(id);
        await assertCanAccess(repository, feedback, user);
        assertOpen(feedback);
    },
    addUserComment: (id, user, body, file) => addComment(id, user, body, file),
    addAdminComment: (id, userId, body, file) => addComment(id, { id: userId }, body, file, true),
    async getCommentAttachment(id, commentId, user, admin) {
        const feedback = await repository.find(id);
        const includeInternal = admin || await assertCanAccess(repository, feedback, user);
        const attachment = await repository.findCommentAttachment(id, commentId, includeInternal);
        if (!attachment) throw new AppError(404, 'FILE_NOT_FOUND', 'Ek dosya bulunamadı.');
        return attachment;
    },
    async improveText(body) {
        const prompt = [
            'Türkçe yazılmış bir çalışan geri bildirimi metnini düzenle.',
            `Bağlam: ${body.context}`,
            '',
            'Kurallar:',
            '- Anlamı değiştirme.',
            '- Kişinin niyetini koru.',
            '- Daha anlaşılır, düzgün, saygılı ve iş ortamına uygun hale getir.',
            '- Gereksiz süsleme, abartı ve yeni bilgi ekleme.',
            '- Sadece düzenlenmiş metni döndür, açıklama yazma.',
            '',
            'Metin:',
            body.text
        ].join('\n');
        return dependencies.generateText(prompt);
    },
    async create(body, userId, options = {}) {
        let storedFile = null;
        if (options.file) {
            storedFile = await dependencies.storeFile(options.file);
        }
        try {
            await inTransaction(async txRepository => {
                const id = await txRepository.create({
                    userId: body.is_anonymous ? null : userId,
                    type: body.type,
                    title: body.title,
                    content: body.content,
                    details: body.details,
                    filePath: storedFile?.filePath,
                    storageProvider: storedFile?.provider,
                    storageKey: storedFile?.storageKey
                });
                await txRepository.addHistory(
                    id,
                    body.is_anonymous ? null : userId,
                    null,
                    'pending',
                    options.suggestion ? 'Öneri oluşturuldu' : 'Bildirim oluşturuldu'
                );
            });
        } catch (error) {
            if (storedFile) {
                await removeStoredFile(storedFile).catch(cleanupError => {
                    console.error(JSON.stringify({
                        level: 'error',
                        event: 'feedback_upload_compensation_failed',
                        message: cleanupError.message
                    }));
                });
            }
            throw error;
        }
    },
    async assign(id, body, userId) {
        await inTransaction(async txRepository => {
            const feedback = await txRepository.findForUpdate(id);
            if (!feedback) {
                throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Kayıt bulunamadı.');
            }
            assertOpen(feedback);
            if (!body.assigned_to_user_id && !body.assigned_department?.trim()) {
                throw new AppError(400, 'FEEDBACK_ASSIGNMENT_REQUIRED', 'Sorumlu kişi veya ilgili birim seçin.');
            }
            const userIds = [...body.participant_user_ids];
            if (body.assigned_to_user_id) userIds.push(body.assigned_to_user_id);
            if (!await txRepository.validateUsers(userIds)) {
                throw new AppError(400, 'FEEDBACK_INVALID_USER', 'Yalnız aktif kullanıcılar sürece eklenebilir.');
            }
            const nextStatus = feedback.status === 'pending' ? 'assigned' : feedback.status;
            await txRepository.updateAssignment(id, { ...body, status: nextStatus });
            if (body.replace_participants) await txRepository.replaceParticipants(id, userIds, userId);
            else await txRepository.addParticipants(id, userIds, userId);
            if (body.assigned_to_user_id && Number(body.assigned_to_user_id) !== Number(feedback.assigned_to_user_id)) {
                await txRepository.resetReview(id, body.assigned_to_user_id);
            }
            if (body.note?.trim()) await txRepository.addComment(id, userId, body.note.trim(), false);
            await txRepository.addHistory(
                id,
                userId,
                feedback.status,
                nextStatus,
                body.note || 'İlgili kişilere atandı'
            );
        });
    },
    addParticipants: (id, userIds, addedBy) => addParticipants(id, userIds, addedBy),
    addAssignedParticipants: (id, userIds, addedBy) => addParticipants(id, userIds, addedBy, true),
    async completeReview(id, user) {
        await inTransaction(async txRepository => {
            const feedback = await txRepository.findForUpdate(id);
            if (!feedback) throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Kayıt bulunamadı.');
            if (Number(feedback.assigned_to_user_id) !== Number(user.id)) {
                throw new AppError(403, 'FEEDBACK_REVIEW_DENIED', 'Yalnız atanan sorumlu incelemeyi tamamlayabilir.');
            }
            assertOpen(feedback);
            await txRepository.addParticipants(id, [user.id], user.id);
            const result = await txRepository.completeReview(id, user.id);
            if (!result.changes) return;
            const nextStatus = startsReview(feedback.status) ? 'in_review' : feedback.status;
            await txRepository.updateStatus(id, nextStatus);
            await txRepository.addHistory(id, user.id, feedback.status, nextStatus, 'Sorumlu incelemesini tamamladı');
        });
    },
    async decide(id, body, userId) {
        await inTransaction(async txRepository => {
            const feedback = await txRepository.findForUpdate(id);
            if (!feedback) {
                throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Kayıt bulunamadı.');
            }
            if (isClosed(feedback.status)) {
                throw new AppError(409, 'FEEDBACK_CLOSED', 'Kararı değiştirmeden önce kaydı yeniden açın.');
            }
            if (!body.decision || !body.public_response?.trim()) {
                throw new AppError(400, 'FEEDBACK_RESULT_REQUIRED', 'Kapatmak için karar ve çalışana yanıt girin.');
            }
            const nextStatus = body.decision === 'rejected' ? 'rejected' : 'resolved';
            await txRepository.updateDecision(id, { ...body, status: nextStatus });
            await txRepository.addHistory(
                id,
                userId,
                feedback.display_status,
                body.decision,
                'Sonuç kaydedildi'
            );
        });
    },
    async updateStatus(id, status, userId) {
        await inTransaction(async txRepository => {
            const feedback = await txRepository.findForUpdate(id);
            if (!feedback) {
                throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Kayıt bulunamadı.');
            }
            if (!isClosed(feedback.status) || status !== 'in_review') {
                throw new AppError(409, 'FEEDBACK_STAGE_AUTOMATIC', 'Açık kayıtların aşaması otomatik ilerler. Bu işlem yalnız kapalı kaydı yeniden açar.');
            }
            await txRepository.updateStatus(id, status);
            await txRepository.resetReview(id);
            await txRepository.addHistory(
                id,
                userId,
                feedback.display_status,
                status,
                'Kayıt yeniden açıldı'
            );
        });
    }
    });
};

const createFeedbackServiceForDb = (db, dependencies = {}) => {
    const storage = createUploadStorageService();
    return createFeedbackService(createFeedbackRepository(db), {
        ...dependencies,
        storeFile: dependencies.storeFile || storeFeedbackFile,
        removeStoredFile: dependencies.removeStoredFile || (stored => storage.remove(stored)),
        transaction: work => db.transaction(
            tx => work(createFeedbackRepository(tx))
        )
    });
};

module.exports = {
    createFeedbackService,
    createFeedbackServiceForDb,
    storeFeedbackFile
};
