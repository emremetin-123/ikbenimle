const scheduleDateKey = (date = new Date()) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
        timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const createScheduleService = ({
    db,
    repository,
    addAudit,
    dateKey,
    addMonths,
    addDays,
    buildPeriodName,
    openDraftPeriod
}) => {
    const saveSchedule = async (req, data) => {
        const current = await repository.getSchedule(data.departmentId);
        await repository.saveSchedule(current, data);
        const updated = await repository.getSchedule(data.departmentId);
        await addAudit(db, req, {
            entityType: 'schedule',
            entityId: updated.id,
            action: current ? 'updated' : 'created',
            oldValue: current,
            newValue: updated
        });
        return updated;
    };

    const runDueSchedules = async (req, runDate = '') => {
        const today = dateKey(runDate) || scheduleDateKey();
        const summary = { opened: 0, closed: 0, skipped: 0, blocked: [], errors: [] };
        const dueOpenPeriods = await repository.listDueOpenPeriods(today);
        for (const period of dueOpenPeriods) {
            try {
                await repository.transaction(async (tx) => {
                    await repository.closePeriod(period.id, req.user.id, tx);
                    await addAudit(tx, req, {
                        entityType: 'period',
                        entityId: period.id,
                        action: 'auto_closed',
                        reason: 'Takvim süresi dolduğu için otomatik kapatıldı'
                    });
                });
                summary.closed += 1;
            } catch (error) {
                summary.errors.push({ period_id: period.id, message: error.message });
            }
        }

        for (const schedule of await repository.listActiveSchedules()) {
            const start = dateKey(schedule.next_start_date) || today;
            if (start > today) {
                summary.skipped += 1;
                continue;
            }
            try {
                const frequency = Math.max(1, Number(schedule.frequency_months || 12));
                const duration = Math.max(1, Number(schedule.duration_days || 30));
                const end = addDays(start, duration - 1);
                const name = buildPeriodName(start, frequency);
                const activePeriod = await repository.findActivePeriod(schedule.department_id);
                if (activePeriod?.status === 'open') {
                    summary.skipped += 1;
                    summary.blocked.push({ schedule_id: schedule.id, department: schedule.department_name,
                        period_id: activePeriod.id,
                        message: `${schedule.department_name}: ${activePeriod.name} dönemi hâlâ açık (son tarih: ${dateKey(activePeriod.due_date)}). Yeni dönem mevcut dönem kapatıldıktan sonra açılabilir.` });
                    continue;
                }
                let periodId = activePeriod?.id || null;
                if (activePeriod) {
                    const activeStart = dateKey(activePeriod.start_date);
                    const isScheduledDraft = activePeriod.name === buildPeriodName(activeStart, frequency)
                        && dateKey(activePeriod.end_date) === addDays(activeStart, duration - 1);
                    if (!isScheduledDraft) {
                        summary.skipped += 1;
                        summary.errors.push({
                            schedule_id: schedule.id,
                            department: schedule.department_name,
                            message: 'Bölümde manuel hazırlanmış bir taslak dönem bulunduğu için otomatik dönem açılmadı.'
                        });
                        continue;
                    }
                } else {
                    periodId = await repository.createPeriod({
                        department_id: schedule.department_id,
                        name,
                        start_date: start,
                        end_date: end,
                        due_date: end,
                        status: 'draft'
                    });
                    await addAudit(db, req, {
                        entityType: 'period',
                        entityId: periodId,
                        action: 'created_automatically',
                        newValue: {
                            schedule_id: schedule.id,
                            start_date: start,
                            due_date: end
                        }
                    });
                }
                await openDraftPeriod(req, periodId);
                await repository.updateScheduleNextStart(
                    schedule.id,
                    addMonths(activePeriod ? dateKey(activePeriod.start_date) : start, frequency)
                );
                summary.opened += 1;
            } catch (error) {
                summary.errors.push({
                    schedule_id: schedule.id,
                    department: schedule.department_name,
                    message: error.message
                });
            }
        }
        return summary;
    };

    return { runDueSchedules, saveSchedule };
};

module.exports = { createScheduleService, scheduleDateKey };
