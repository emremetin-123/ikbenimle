const { AppError } = require('../../../core/http');

const MANAGE_PERMISSION = 'manage_polyvalence';
const toBool = value => value === true || value === 1 || value === '1' || value === 'true';
const parsePermissions = (user) => {
    try {
        const permissions = typeof user?.permissions === 'string'
            ? JSON.parse(user.permissions)
            : user?.permissions;
        return Array.isArray(permissions) ? permissions : [];
    } catch {
        return [];
    }
};
const canManage = user => user?.role === 'admin' || parsePermissions(user).includes(MANAGE_PERMISSION);

const createTaskService = ({ repository, taskListRepository }) => {
    const loadTask = async (user, taskId) => {
        const task = await repository.getTask(taskId);
        if (!task) throw new AppError(404, 'NOT_FOUND', 'Değerlendirme görevi bulunamadı.');
        if (!canManage(user) && Number(task.evaluator_user_id) !== Number(user.id)) {
            throw new AppError(403, 'FORBIDDEN', 'Bu değerlendirme görevi size ait değil.');
        }
        return task;
    };

    const getTask = async (user, taskId) => {
        const task = await loadTask(user, taskId);
        const [rows, levels] = await Promise.all([
            repository.listTaskAssessments(task), repository.listLevels()
        ]);
        const memberMap = new Map();
        for (const row of rows) {
            if (!memberMap.has(row.period_member_id)) {
                memberMap.set(row.period_member_id, {
                    id: row.period_member_id,
                    user_id: row.user_id,
                    employee_id: row.employee_id_snapshot,
                    name: row.employee_name_snapshot,
                    position: row.position_snapshot,
                    assessments: []
                });
            }
            memberMap.get(row.period_member_id).assessments.push({
                id: row.assessment_id,
                skill_id: row.skill_id,
                skill_code: row.skill_code_snapshot,
                skill_name: row.skill_name_snapshot,
                category: row.category_name_snapshot || 'Genel',
                target_level: row.target_level_snapshot,
                level: row.level_value,
                can_train: toBool(row.can_train),
                note: row.note || '',
                version_no: Number(row.version_no || 0),
                updated_at: row.updated_at
            });
        }
        const completed = rows.filter(row => row.level_value != null).length;
        return {
            ...task,
            levels,
            progress: {
                completed,
                total: rows.length,
                percent: rows.length ? Math.round((completed / rows.length) * 100) : 0
            },
            members: Array.from(memberMap.values())
        };
    };

    const updateAssessment = async (req, taskId, assessmentId, body) => {
        const task = await loadTask(req.user, taskId);
        if (task.period_status !== 'open') {
            throw new AppError(409, 'PERIOD_CLOSED', 'Bu dönem artık düzenlenemez.');
        }
        if (task.status === 'completed') {
            throw new AppError(409, 'TASK_COMPLETED', 'Tamamlanan görev yeniden açılmadan değiştirilemez.');
        }
        const assessment = await repository.getAssessment(assessmentId, task);
        if (!assessment) throw new AppError(404, 'NOT_FOUND', 'Değerlendirme kaydı bulunamadı.');
        const level = body.level == null || body.level === '' ? null : Number(body.level);
        const canTrain = toBool(body.can_train);
        if (canTrain && level !== 3) {
            throw new AppError(400, 'INVALID_CAN_TRAIN_LEVEL', 'Eğitim verebilir işareti yalnızca seviye 3 için kullanılabilir.');
        }
        const note = String(body.note || '').trim();
        const oldLevel = assessment.level_value == null ? null : Number(assessment.level_value);
        const oldCanTrain = toBool(assessment.can_train);
        const requiresReason = (oldLevel !== null && level !== null && level < oldLevel)
            || oldCanTrain !== canTrain;
        if (requiresReason && !note) {
            throw new AppError(400, 'REASON_REQUIRED', 'Puan düşürme ve eğitim verebilir değişikliklerinde açıklama zorunludur.');
        }
        const result = await repository.updateAssessment(assessmentId, Number(body.version_no), {
            level,
            canTrain,
            note,
            userId: req.user.id
        });
        if (!result.changes) {
            throw new AppError(409, 'VERSION_CONFLICT', 'Kayıt başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.');
        }
        await repository.markTaskInProgress(task.id);
        await repository.insertAudit(req, {
            entityType: 'assessment',
            entityId: assessmentId,
            action: 'updated',
            oldValue: { level: oldLevel, can_train: oldCanTrain, note: assessment.note || '' },
            newValue: { level, can_train: canTrain, note },
            reason: note
        });
        const updated = await repository.getAssessmentResult(assessmentId);
        return { ...updated, can_train: toBool(updated.can_train) };
    };

    const completeTask = async (req, taskId) => {
        const task = await loadTask(req.user, taskId);
        if (task.period_status !== 'open') {
            throw new AppError(409, 'PERIOD_CLOSED', 'Bu dönem açık değil.');
        }
        const missing = await repository.countMissingAssessments(task);
        if (Number(missing?.count || 0) > 0) {
            throw new AppError(
                400,
                'ASSESSMENTS_INCOMPLETE',
                `${missing.count} değerlendirme henüz tamamlanmadı.`
            );
        }
        await repository.completeTask(task.id);
        await repository.insertAudit(req, {
            entityType: 'review_task',
            entityId: task.id,
            action: 'completed'
        });
        return { success: true };
    };

    return {
        hasTasks: userId => taskListRepository.hasReviewTasksForEvaluator(userId),
        listTasks: userId => taskListRepository.listReviewTasksForEvaluator(userId),
        getTask,
        updateAssessment,
        completeTask
    };
};

module.exports = { createTaskService };
