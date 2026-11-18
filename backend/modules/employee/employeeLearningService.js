const crypto = require('node:crypto');
const { parsePagination, paginatedResponse } = require('../../core/pagination');
const {
    isEnabled,
    parseQuiz,
    sanitizeQuiz,
    calculateQuizScore,
    logTrainingEvent,
    refreshAssignmentCompletion
} = require('./employeeTrainingService');
const { recordVideoProgress, startSession } = require('./trainingProgressService');

const result = (status, body) => ({ status, body });

const createEmployeeLearningService = (db, repository) => {
    const loadProgressContext = async (lessonId, userId) => {
        const lesson = await repository.findLessonContext(lessonId);
        if (!lesson) return {};
        lesson.has_quiz = Boolean(parseQuiz(lesson.quiz_data));
        const assignment = await repository.findAssignmentForVideo(userId, lesson.video_id);
        if (!assignment) return { lesson };
        const previous = await repository.findPreviousLesson(
            lesson.video_id,
            lesson.order_index
        );
        if (previous) {
            const progress = await repository.findProgressStatus(assignment.id, previous.id);
            if (progress?.status !== 'completed') {
                return { assignment, lesson, locked: true };
            }
        }
        return { assignment, lesson };
    };

    return {
        async getSummary(userId) {
            const summary = await repository.getSummary(userId);
            return {
                total: Number(summary?.total || 0),
                completed: Number(summary?.completed || 0),
                pending: Number(summary?.pending || 0),
                expired: Number(summary?.expired || 0),
                badges: Number(summary?.badges || 0)
            };
        },

        async listTrainings(userId, query) {
            const pagination = parsePagination(query);
            const trainings = await repository.listTrainings(userId, query, pagination);
            return paginatedResponse(
                trainings.items,
                trainings.total,
                pagination.page,
                pagination.pageSize
            );
        },

        async getVideoDetail(videoId, userId) {
            const video = await repository.findVideo(videoId);
            if (!video) return result(404, { error: 'Video not found' });
            const assignment = await repository.findAssignmentForVideo(userId, videoId);
            if (!assignment) return result(403, { error: 'Access denied' });
            if (!assignment.first_accessed_at) {
                await repository.markFirstAccess(assignment.id);
            }
            const lessons = await repository.listLessons(videoId, assignment.id);
            await logTrainingEvent(db, {
                assignment_id: assignment.id,
                user_id: userId,
                video_id: video.id,
                event_type: 'course_opened'
            });
            return result(200, {
                video,
                assignment: {
                    id: assignment.id,
                    status: assignment.status,
                    quiz_score: assignment.quiz_score,
                    reference_id: assignment.reference_id,
                    confirmed_at: assignment.confirmed_at
                },
                lessons: lessons.map(lesson => ({
                    ...lesson,
                    status: lesson.progress_status,
                    score: lesson.progress_score,
                    quiz: sanitizeQuiz(lesson.quiz_data)
                }))
            });
        },

        async submitQuiz(lessonId, userId, answers, req) {
            const lesson = await repository.findQuizLesson(lessonId);
            if (!lesson) return result(404, { error: 'Lesson not found' });
            if (!lesson.quiz_data) {
                return result(400, { error: 'Bu modülde sınav bulunmuyor.' });
            }
            const assignment = await repository.findAssignmentForVideo(userId, lesson.video_id);
            if (!assignment) return result(404, { error: 'Assignment not found' });
            const unfinished = await repository.findUnfinishedModuleLesson(
                assignment.id,
                lesson.module_id,
                lessonId
            );
            if (unfinished) {
                return result(409, { error: 'Modüldeki tüm içerikler tamamlanmalıdır.' });
            }
            const existing = await repository.findLessonProgress(assignment.id, lessonId);
            if (existing?.status !== 'watched' && existing?.status !== 'completed') {
                return result(409, { error: 'Sınavdan önce son içerik tamamlanmalıdır.' });
            }
            if (existing?.requires_rewatch) {
                return result(400, { error: 'Quiz hakkınız doldu. Lütfen videoyu tekrar izleyin.' });
            }
            if (
                isEnabled(lesson.requires_full_watch)
                && existing?.status !== 'watched'
                && existing?.status !== 'completed'
            ) {
                return result(400, {
                    error: 'Sınava girmeden önce video izleme koşulunu tamamlamalısınız.'
                });
            }

            const nextAttempts = Number(existing?.quiz_attempts || 0) + 1;
            const { score, correct, total } = calculateQuizScore(lesson.quiz_data, answers);
            const passed = Number(score) >= Number(lesson.pass_score || 0);
            const attemptLimit = Number(lesson.quiz_attempt_limit || 0);
            const shouldRequireRewatch = !passed
                && attemptLimit > 0
                && nextAttempts >= attemptLimit;
            const values = {
                status: passed ? 'completed' : 'watched',
                score,
                attempts: nextAttempts,
                requiresRewatch: shouldRequireRewatch ? 1 : 0
            };
            if (existing) {
                await repository.updateQuizProgress(existing.id, values);
            } else {
                await repository.createQuizProgress(assignment.id, lessonId, values);
            }
            await repository.createTrainingAttempt(assignment.id, lessonId, userId, {
                score,
                passed: passed ? 1 : 0,
                answersJson: JSON.stringify(answers)
            });
            await logTrainingEvent(db, {
                assignment_id: assignment.id,
                user_id: userId,
                video_id: lesson.video_id,
                lesson_id: Number(lessonId),
                event_type: 'quiz_submitted',
                req,
                event_data: { score, passed, correct, total, attempt: nextAttempts }
            });
            await refreshAssignmentCompletion(db, assignment.id, lesson.video_id);
            return result(200, {
                success: true,
                passed,
                score,
                attempts: nextAttempts,
                requires_rewatch: shouldRequireRewatch
            });
        },

        async confirmAssignment(assignmentId, userId, req) {
            let assignment = await repository.findAssignmentByIdForUser(
                assignmentId,
                userId
            );
            if (!assignment) return result(404, { error: 'Assignment not found' });
            if (assignment.status !== 'completed') {
                await refreshAssignmentCompletion(db, assignment.id, assignment.video_id);
                assignment = await repository.findAssignmentByIdForUser(assignmentId, userId);
            }
            if (assignment.status !== 'completed') {
                return result(400, { error: 'Eğitim henüz tamamlanmamış.' });
            }
            const video = await repository.findVideoCertificateSetting(assignment.video_id);
            if (video && (video.certificate_enabled === 0 || video.certificate_enabled === false)) {
                return result(400, { error: 'Bu egitim icin sertifika olusturulmaz.' });
            }
            if (assignment.reference_id) {
                return result(200, { success: true, reference_id: assignment.reference_id });
            }
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomStr = crypto.randomBytes(16).toString('hex').toUpperCase();
            const referenceId = `CERT-${dateStr}-${randomStr}`;
            await repository.confirmAssignment(assignmentId, referenceId);
            await logTrainingEvent(db, {
                assignment_id: assignment.id,
                user_id: userId,
                video_id: assignment.video_id,
                event_type: 'certificate_confirmed',
                req,
                event_data: { reference_id: referenceId }
            });
            return result(200, { success: true, reference_id: referenceId });
        },

        async startWatch(lessonId, userId) {
            const { assignment, lesson, locked } = await loadProgressContext(lessonId, userId);
            if (!lesson) return result(404, { error: 'Lesson not found' });
            if (!assignment) return result(404, { error: 'Assignment not found' });
            if (locked) {
                return result(409, { error: 'Önceki içerik tamamlanmalıdır.' });
            }
            return result(200, await startSession(db, {
                assignmentId: assignment.id,
                lessonId: lesson.id,
                userId
            }));
        },

        async recordWatch(lessonId, userId, body, req) {
            const { assignment, lesson, locked } = await loadProgressContext(lessonId, userId);
            if (!lesson) return result(404, { error: 'Lesson not found' });
            if (!assignment) return result(404, { error: 'Assignment not found' });
            if (locked) {
                return result(409, { error: 'Önceki içerik tamamlanmalıdır.' });
            }

            if (String(lesson.content_type || 'video') !== 'video') {
                const activeSeconds = Math.max(0, Math.round(Number(body.active_seconds || 0)));
                const pageNumber = Math.max(0, Math.round(Number(body.page_number || 0)));
                const pageCount = Math.max(0, Math.round(Number(body.page_count || 0)));
                const submitted = Math.max(
                    0,
                    Math.min(100, Math.round(Number(body.content_progress_percent || 0)))
                );
                const progress = pageCount > 0
                    ? Math.round((Math.min(pageNumber, pageCount) / pageCount) * 100)
                    : submitted;
                const requiredPercent = Math.max(0, Number(lesson.required_percent || 80));
                const requiredSeconds = Math.max(0, Number(lesson.required_seconds || 0));
                const satisfied = Boolean(body.content_completed)
                    || progress >= requiredPercent
                    || (requiredSeconds > 0 && activeSeconds >= requiredSeconds);
                const status = satisfied
                    ? (lesson.has_quiz ? 'watched' : 'completed')
                    : 'assigned';
                await repository.upsertDocumentProgress(assignment.id, lesson.id, {
                    status,
                    activeSeconds,
                    progress,
                    pageNumber,
                    pageCount
                });
                if (status === 'completed') {
                    await refreshAssignmentCompletion(db, assignment.id, lesson.video_id);
                }
                return result(200, { success: true, status, watch_percent: progress });
            }

            const progressResult = await recordVideoProgress(db, {
                assignment,
                lesson,
                userId,
                body
            });
            if (progressResult.status === 'completed') {
                await refreshAssignmentCompletion(db, assignment.id, lesson.video_id);
            }
            await logTrainingEvent(db, {
                assignment_id: assignment.id,
                user_id: userId,
                video_id: lesson.video_id,
                lesson_id: Number(lesson.id),
                event_type: progressResult.secureSatisfied
                    ? 'lesson_watched'
                    : 'lesson_progress',
                req,
                event_data: {
                    server_active_seconds: progressResult.serverActive,
                    watch_percent: progressResult.watchPercent,
                    enforcement_mode: progressResult.mode
                }
            });
            return result(200, {
                success: true,
                status: progressResult.status,
                watch_percent: progressResult.watchPercent
            });
        }
    };
};

module.exports = { createEmployeeLearningService };
