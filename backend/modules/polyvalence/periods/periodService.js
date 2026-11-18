const { AppError } = require('../../../core/http');
const pushService = require('../../../services/pushNotificationService');
const { createScheduleService } = require('../scheduling/scheduleService');

const createPeriodService = ({
    db,
    repository,
    addAudit,
    toBool,
    dateKey,
    addMonths,
    addDays,
    buildPeriodName,
    syncMemberships
}) => {
    const loadTargetedContext = async (departmentId) => {
        const [members, targets] = await Promise.all([
            repository.listActiveMembers(departmentId),
            repository.listActiveTargets(departmentId)
        ]);
        const targetsByRole = new Map();
        const targetedSkills = new Map();
        for (const target of targets) {
            const roleId = Number(target.role_id);
            if (!targetsByRole.has(roleId)) targetsByRole.set(roleId, []);
            targetsByRole.get(roleId).push(target);
            if (!targetedSkills.has(Number(target.skill_id))) {
                targetedSkills.set(Number(target.skill_id), {
                    id: Number(target.skill_id),
                    name: target.skill_name,
                    category_name: target.category_name || 'Genel'
                });
            }
        }
        return {
            members,
            targetsByRole,
            targetedSkills: [...targetedSkills.values()]
        };
    };

    const validateTargetedContext = (members, targetsByRole) => {
        if (!members.length) {
            throw new AppError(400, 'PERIOD_HAS_NO_MEMBERS', 'Bu bölüm için aktif çalışan eşleşmesi bulunmuyor.');
        }
        const missingEvaluators = members.filter(member => !member.evaluator_user_id || !member.evaluator_name);
        if (missingEvaluators.length) {
            throw new AppError(
                400,
                'PERIOD_EVALUATOR_MISSING',
                `${missingEvaluators.length} çalışanın değerlendirecek amiri eksik.`
            );
        }
        const missingRoles = members.filter(member => !member.role_id);
        if (missingRoles.length) {
            throw new AppError(
                400,
                'PERIOD_ROLE_MISSING',
                `${missingRoles.length} çalışanın pozisyon profili eksik.`
            );
        }
        const missingTargets = members.filter(
            member => !targetsByRole.get(Number(member.role_id))?.length
        );
        if (missingTargets.length) {
            throw new AppError(
                400,
                'PERIOD_TARGET_MISSING',
                `${missingTargets.length} çalışanın pozisyonu için hedef beceri tanımlı değil.`
            );
        }
    };

    const buildCarryOverMap = async (departmentId, periodId = null) => {
        const previous = await repository.findLatestClosedPeriod(departmentId, periodId);
        const rows = await repository.listAssessmentCarryOver(previous?.id);
        return {
            previousPeriodId: previous?.id || null,
            values: new Map(rows.map(row => [`${row.user_id}:${row.skill_id}`, row]))
        };
    };

    const carryOverValue = (previous) => {
        const level = previous?.level_value === null || previous?.level_value === undefined
            ? null
            : Number(previous.level_value);
        return {
            level,
            canTrain: level === 3 && toBool(previous?.can_train)
        };
    };

    const openDraftPeriod = async (req, periodId) => {
        const period = await repository.getPeriodWithDepartment(periodId);
        if (!period) throw new AppError(404, 'PERIOD_NOT_FOUND', 'Dönem bulunamadı.');
        if (period.status !== 'draft') {
            throw new AppError(409, 'PERIOD_NOT_DRAFT', 'Yalnızca taslak dönem açılabilir.');
        }
        if (await repository.findOtherOpenPeriod(period.department_id, periodId)) {
            throw new AppError(
                409,
                'PERIOD_ALREADY_OPEN',
                'Bu bölüm için zaten açık bir değerlendirme var.'
            );
        }

        if (syncMemberships) {
            await syncMemberships({ overwrite: false, departmentId: period.department_id });
        }
        const { members, targetsByRole, targetedSkills } = await loadTargetedContext(period.department_id);
        validateTargetedContext(members, targetsByRole);
        if (!targetedSkills.length) {
            throw new AppError(
                400,
                'PERIOD_SKILL_MISSING',
                'Bu bölüm için pozisyon hedefi tanımlı aktif beceri bulunmuyor.'
            );
        }
        const carryOver = await buildCarryOverMap(period.department_id);

        const evaluatorIds = await repository.transaction(async (tx) => {
            await repository.markPeriodOpen(
                periodId,
                carryOver.previousPeriodId,
                req.user.id,
                tx
            );
            const memberIds = new Map();
            for (const member of members) {
                memberIds.set(
                    Number(member.user_id),
                    await repository.insertPeriodMember(periodId, member, tx)
                );
            }
            const skillIds = new Map();
            for (const skill of targetedSkills) {
                skillIds.set(
                    Number(skill.id),
                    await repository.insertPeriodSkill(periodId, skill, tx)
                );
            }
            for (const member of members) {
                const memberTargets = targetsByRole.get(Number(member.role_id)) || [];
                for (const target of memberTargets) {
                    await repository.insertAssessment(
                        periodId,
                        memberIds.get(Number(member.user_id)),
                        skillIds.get(Number(target.skill_id)),
                        target,
                        carryOverValue(carryOver.values.get(`${member.user_id}:${target.skill_id}`)),
                        tx
                    );
                }
            }
            const uniqueEvaluators = [...new Set(
                members.map(member => Number(member.evaluator_user_id))
            )];
            for (const evaluatorId of uniqueEvaluators) {
                await repository.insertTask(periodId, evaluatorId, tx);
            }
            await addAudit(tx, req, {
                entityType: 'period',
                entityId: periodId,
                action: 'opened',
                newValue: {
                    previous_period_id: carryOver.previousPeriodId,
                    member_count: members.length,
                    skill_count: targetedSkills.length
                }
            });
            return uniqueEvaluators;
        });

        pushService.sendTemplatedToUsers(db, evaluatorIds, 'polyvalence_period_opened', {
            department: period.department_name,
            periodName: period.name,
            title: 'Polivalans değerlendirmesi açıldı',
            body: `${period.department_name} / ${period.name} değerlendirmeleri sizi bekliyor.`,
            url: '/employee/polivalans',
            tag: `polyvalence-period-${periodId}`
        }).catch(error => console.error('Polyvalence open notification error:', error.message));

        return {
            success: true,
            member_count: members.length,
            skill_count: targetedSkills.length,
            evaluator_count: evaluatorIds.length
        };
    };

    const { runDueSchedules, saveSchedule } = createScheduleService({
        db,
        repository,
        addAudit,
        dateKey,
        addMonths,
        addDays,
        buildPeriodName,
        openDraftPeriod
    });

    const calculateOpenPeriodGaps = async (period) => {
        const { members, targetsByRole } = await loadTargetedContext(period.department_id);
        const [periodMembers, periodSkills, assessments] = await Promise.all([
            repository.listPeriodMembers(period.id),
            repository.listPeriodSkills(period.id),
            repository.listPeriodAssessmentKeys(period.id)
        ]);
        const memberMap = new Map(periodMembers.map(item => [Number(item.user_id), item]));
        const skillMap = new Map(periodSkills.map(item => [Number(item.skill_id), item]));
        const assessmentSet = new Set(
            assessments.map(item => `${item.period_member_id}:${item.skill_id}`)
        );
        const missingSkillIds = new Set();
        let missingMembers = 0;
        let missingAssessments = 0;
        let skippedMembers = 0;
        for (const member of members) {
            const memberTargets = member.role_id
                ? targetsByRole.get(Number(member.role_id)) || []
                : [];
            if (!member.evaluator_user_id || !memberTargets.length) {
                skippedMembers += 1;
                continue;
            }
            const periodMember = memberMap.get(Number(member.user_id));
            if (!periodMember) missingMembers += 1;
            for (const target of memberTargets) {
                const skillId = Number(target.skill_id);
                if (!skillMap.has(skillId)) missingSkillIds.add(skillId);
                if (!periodMember || !assessmentSet.has(`${periodMember.id}:${skillId}`)) {
                    missingAssessments += 1;
                }
            }
        }
        return {
            period_id: period.id,
            period_name: period.name,
            department_id: period.department_id,
            department_name: period.department_name,
            missing_members: missingMembers,
            missing_skills: missingSkillIds.size,
            missing_assessments: missingAssessments,
            skipped_members: skippedMembers,
            has_gaps: missingMembers > 0 || missingSkillIds.size > 0 || missingAssessments > 0
        };
    };

    const listOpenPeriodGaps = async () => {
        const gaps = [];
        for (const period of await repository.listOpenPeriods()) {
            const item = await calculateOpenPeriodGaps(period);
            if (item.has_gaps) gaps.push(item);
        }
        return gaps;
    };

    const syncOpenPeriodTargets = async (req, periodId) => {
        const period = await repository.getPeriodWithDepartment(periodId);
        if (!period) throw new AppError(404, 'PERIOD_NOT_FOUND', 'Dönem bulunamadı.');
        if (period.status !== 'open') {
            throw new AppError(409, 'PERIOD_NOT_OPEN', 'Yalnızca açık dönem güncellenebilir.');
        }
        const { members, targetsByRole, targetedSkills } = await loadTargetedContext(
            period.department_id
        );
        const carryOver = await buildCarryOverMap(period.department_id, period.id);
        const skillSnapshot = new Map(targetedSkills.map(skill => [Number(skill.id), skill]));

        const summary = await repository.transaction(async (tx) => {
            const [existingMembers, existingSkills, existingAssessments] = await Promise.all([
                repository.listPeriodMembers(periodId, tx),
                repository.listPeriodSkills(periodId, tx),
                repository.listPeriodAssessmentKeys(periodId, tx)
            ]);
            const memberMap = new Map(
                existingMembers.map(item => [Number(item.user_id), item])
            );
            const skillMap = new Map(
                existingSkills.map(item => [Number(item.skill_id), item])
            );
            const assessmentSet = new Set(
                existingAssessments.map(item => `${item.period_member_id}:${item.skill_id}`)
            );
            const evaluatorIds = new Set();
            const result = {
                added_members: 0,
                added_skills: 0,
                added_assessments: 0,
                reopened_tasks: 0,
                skipped_members: 0
            };
            for (const member of members) {
                const memberTargets = member.role_id
                    ? targetsByRole.get(Number(member.role_id)) || []
                    : [];
                if (!member.evaluator_user_id || !memberTargets.length) {
                    result.skipped_members += 1;
                    continue;
                }
                let periodMember = memberMap.get(Number(member.user_id));
                if (!periodMember) {
                    periodMember = {
                        id: await repository.insertPeriodMember(periodId, member, tx),
                        user_id: member.user_id
                    };
                    memberMap.set(Number(member.user_id), periodMember);
                    result.added_members += 1;
                }
                for (const target of memberTargets) {
                    const skillId = Number(target.skill_id);
                    let periodSkill = skillMap.get(skillId);
                    if (!periodSkill) {
                        periodSkill = {
                            id: await repository.insertPeriodSkill(
                                periodId,
                                skillSnapshot.get(skillId) || {
                                    id: skillId,
                                    name: target.skill_name || '-',
                                    category_name: target.category_name || 'Genel'
                                },
                                tx
                            ),
                            skill_id: skillId
                        };
                        skillMap.set(skillId, periodSkill);
                        result.added_skills += 1;
                    }
                    if (assessmentSet.has(`${periodMember.id}:${skillId}`)) continue;
                    await repository.insertAssessment(
                        periodId,
                        periodMember.id,
                        periodSkill.id,
                        target,
                        carryOverValue(carryOver.values.get(`${member.user_id}:${skillId}`)),
                        tx
                    );
                    assessmentSet.add(`${periodMember.id}:${skillId}`);
                    result.added_assessments += 1;
                    evaluatorIds.add(Number(member.evaluator_user_id));
                }
            }
            for (const evaluatorId of evaluatorIds) {
                const task = await repository.findTask(periodId, evaluatorId, tx);
                if (!task) {
                    await repository.insertTask(periodId, evaluatorId, tx);
                } else if (task.status === 'completed') {
                    await repository.reopenTaskForSync(task.id, tx);
                    result.reopened_tasks += 1;
                }
            }
            await addAudit(tx, req, {
                entityType: 'period',
                entityId: periodId,
                action: 'open_period_synced',
                newValue: result
            });
            return {
                ...result,
                evaluator_count: evaluatorIds.size,
                evaluator_ids: [...evaluatorIds]
            };
        });

        const notifyEvaluatorIds = summary.evaluator_ids;
        delete summary.evaluator_ids;
        if (notifyEvaluatorIds.length) {
            try {
                await pushService.sendTemplatedToUsers(
                    db,
                    notifyEvaluatorIds,
                    'polyvalence_period_opened',
                    {
                        department: period.department_name,
                        periodName: period.name,
                        title: 'Polivalans değerlendirmesi güncellendi',
                        body: `${period.department_name} / ${period.name} dönemine yeni çalışan veya hedef beceri eklendi.`,
                        url: '/employee/polivalans',
                        tag: `polyvalence-period-sync-${periodId}-${Date.now()}`
                    }
                );
            } catch (error) {
                console.error('Polyvalence sync notification error:', error.message);
            }
        }
        return { success: true, ...summary };
    };

    const closePeriod = async (req, periodId, overrideReason = '') => {
        const period = await repository.getPeriod(periodId);
        if (!period) throw new AppError(404, 'PERIOD_NOT_FOUND', 'Dönem bulunamadı.');
        if (period.status !== 'open') {
            throw new AppError(409, 'PERIOD_NOT_OPEN', 'Yalnızca açık dönem kapatılabilir.');
        }
        const taskCounts = await repository.getTaskCounts(periodId);
        const incomplete = Number(taskCounts?.total || 0) - Number(taskCounts?.completed || 0);
        if (incomplete > 0 && !overrideReason) {
            throw new AppError(
                400,
                'PERIOD_TASKS_INCOMPLETE',
                `${incomplete} amir görevi tamamlanmadı. Zorunlu kapatma için gerekçe girin.`
            );
        }
        let nextPeriod = null;
        await repository.transaction(async (tx) => {
            await repository.closePeriod(periodId, req.user.id, tx);
            await addAudit(tx, req, {
                entityType: 'period',
                entityId: periodId,
                action: incomplete ? 'closed_with_override' : 'closed',
                reason: overrideReason || null,
                newValue: { incomplete_tasks: incomplete }
            });
            const schedule = await repository.getActiveSchedule(period.department_id, tx);
            const existingDraft = await repository.findActivePeriod(period.department_id, tx);
            if (schedule && !existingDraft) {
                const scheduledStart = dateKey(schedule.next_start_date);
                const start = scheduledStart && scheduledStart > dateKey(period.start_date)
                    ? scheduledStart : addMonths(period.start_date, Number(schedule.frequency_months || 12));
                const end = addDays(start, Number(schedule.duration_days || 30) - 1);
                const nextId = await repository.createPeriod({
                    department_id: period.department_id,
                    previous_period_id: periodId,
                    name: buildPeriodName(start, Number(schedule.frequency_months || 12)),
                    start_date: start,
                    end_date: end,
                    due_date: end,
                    status: 'draft'
                }, tx);
                nextPeriod = { id: nextId, start_date: start, due_date: end };
                await repository.updateScheduleNextStart(schedule.id, start, tx);
            }
        });
        return { success: true, next_period: nextPeriod };
    };

    const cancelPeriod = async (req, periodId, reason) => {
        const period = await repository.getPeriod(periodId);
        if (!period) throw new AppError(404, 'PERIOD_NOT_FOUND', 'Dönem bulunamadı.');
        if (!['draft', 'open'].includes(period.status)) {
            throw new AppError(409, 'PERIOD_CANNOT_CANCEL', 'Bu dönem iptal edilemez.');
        }
        await repository.transaction(async (tx) => {
            await repository.cancelPeriod(periodId, req.user.id, reason, tx);
            await repository.cancelPeriodTasks(periodId, tx);
            await addAudit(tx, req, {
                entityType: 'period',
                entityId: periodId,
                action: 'cancelled',
                reason
            });
        });
        return { success: true };
    };

    const reopenTask = async (req, taskId, reason) => {
        const task = await repository.getTaskWithPeriodStatus(taskId);
        if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Görev bulunamadı.');
        if (task.period_status !== 'open') {
            throw new AppError(
                409,
                'TASK_PERIOD_NOT_OPEN',
                'Yalnızca açık dönemde görev yeniden açılabilir.'
            );
        }
        await repository.reopenTask(taskId, req.user.id, reason);
        await addAudit(db, req, {
            entityType: 'review_task',
            entityId: taskId,
            action: 'reopened',
            reason
        });
        return { success: true };
    };

    return {
        openDraftPeriod,
        saveSchedule,
        runDueSchedules,
        listOpenPeriodGaps,
        syncOpenPeriodTargets,
        closePeriod,
        cancelPeriod,
        reopenTask
    };
};

module.exports = { createPeriodService };
