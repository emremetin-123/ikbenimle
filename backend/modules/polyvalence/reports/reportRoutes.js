const { Router } = require('express');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const { validate } = require('../../../core/validation');
const { buildPolyvalenceDashboard } = require('../dashboardService');
const { assignTrainingUsers } = require('../../training/trainingAssignmentService');
const { createReportRepository } = require('./reportRepository');
const {
    gapTrainingAssignmentBodySchema,
    periodIdParamsSchema,
    reportDashboardQuerySchema,
    reportExportQuerySchema
} = require('./reportSchemas');

const MANAGE_PERMISSION = 'manage_polyvalence';

const createPeriodLabelHelpers = (dateKey) => {
    const periodGroupLabel = (startDate, endDate) => {
        const start = new Date(`${dateKey(startDate)}T12:00:00Z`);
        const end = new Date(`${dateKey(endDate)}T12:00:00Z`);
        const year = start.getUTCFullYear();
        if (start.getUTCFullYear() === end.getUTCFullYear()) {
            const startMonth = start.getUTCMonth() + 1;
            const endMonth = end.getUTCMonth() + 1;
            if (startMonth <= 1 && endMonth >= 12) return `${year} Yıllık`;
            if (startMonth <= 1 && endMonth <= 6) return `${year} 1. Yarıyıl`;
            if (startMonth >= 7 && endMonth >= 12) return `${year} 2. Yarıyıl`;
            const quarter = Math.floor((startMonth - 1) / 3) + 1;
            if (endMonth - startMonth <= 2) return `${year} ${quarter}. Çeyrek`;
        }
        return `${dateKey(startDate)} - ${dateKey(endDate)}`;
    };
    return {
        periodGroupKey: (period) => `${dateKey(period.start_date)}_${dateKey(period.end_date)}`,
        periodDisplayLabel: (period) => {
            const rawName = String(period?.name || '').trim();
            return rawName ? rawName.replace(/\s*Değerlendirmesi$/i, '') : periodGroupLabel(period?.start_date, period?.end_date);
        }
    };
};

const createReportRouter = ({
    db,
    repository,
    ensureAdminReport,
    loadReportScopeDepartment,
    assertReportPeriodAccess,
    addAudit,
    toId,
    toBool,
    dateKey,
    csvCell
}) => {
    const router = Router();
    const reportRepository = createReportRepository(db);
    const { periodGroupKey, periodDisplayLabel } = createPeriodLabelHelpers(dateKey);

    router.get('/admin/report-period-groups', authenticateToken, ensureAdminReport, async (req, res) => {
        try {
            const scopeDepartment = await loadReportScopeDepartment(db, req.user);
            if (!scopeDepartment) return res.json([]);
            const periods = await reportRepository.listPeriodGroups(
                scopeDepartment === 'all' ? null : scopeDepartment.id
            );
            const groups = new Map();
            for (const period of periods) {
                const key = periodGroupKey(period);
                if (!groups.has(key)) {
                    groups.set(key, {
                        key,
                        label: periodDisplayLabel(period),
                        start_date: dateKey(period.start_date),
                        end_date: dateKey(period.end_date),
                        due_date: dateKey(period.due_date),
                        period_count: 0,
                        task_total: 0,
                        task_completed: 0,
                        departments: []
                    });
                }
                const group = groups.get(key);
                group.period_count += 1;
                group.task_total += Number(period.task_total || 0);
                group.task_completed += Number(period.task_completed || 0);
                if (!group.label && period.name) group.label = periodDisplayLabel(period);
                group.departments.push({
                    id: period.department_id,
                    name: period.department_name,
                    period_id: period.id,
                    status: period.status
                });
            }
            res.json(Array.from(groups.values()));
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });
    
    router.get('/admin/report-dashboard', authenticateToken, ensureAdminReport, validate({ query: reportDashboardQuerySchema }), async (req, res) => {
        try {
            const requestedKey = String(req.query.group_key || '').trim();
            const departmentQuery = String(req.query.department_id || 'all').trim();
            const periodId = toId(req.query.period_id);
            const positionQuery = String(req.query.position || 'all').trim();
            const scopeDepartment = await loadReportScopeDepartment(db, req.user);
            if (!scopeDepartment) {
                return res.json({
                    group: null,
                    departments: [],
                    positions: [],
                    selected_department_id: departmentQuery === 'all' ? 'all' : Number(departmentQuery),
                    selected_position: positionQuery,
                    period_ids: [],
                    tasks: [],
                    summary: { polyvalence_rate: 0, polyvalence_delta: null, average_skill_per_employee: 0, average_skill_delta: null, critical_risk_count: 0, completion_percent: 0, completed_employees: 0, total_employees: 0 },
                    operation_risks: [],
                    heatmap: { departments: [], categories: [], cells: [] },
                    department_comparison: [],
                    top_employees: [],
                    development_skills: []
                });
            }
            const allPeriods = await reportRepository.listPeriodsForScope(
                scopeDepartment === 'all' ? null : scopeDepartment.id
            );
            if (!allPeriods.length) {
                return res.json({
                    group: null,
                    departments: [],
                    positions: [],
                    selected_department_id: departmentQuery === 'all' ? 'all' : Number(departmentQuery),
                    selected_position: positionQuery,
                    period_ids: [],
                    tasks: [],
                    summary: { polyvalence_rate: 0, polyvalence_delta: null, average_skill_per_employee: 0, average_skill_delta: null, critical_risk_count: 0, completion_percent: 0, completed_employees: 0, total_employees: 0 },
                    operation_risks: [],
                    heatmap: { departments: [], categories: [], cells: [] },
                    department_comparison: [],
                    top_employees: [],
                    development_skills: []
                });
            }
    
            const selectedPeriod = periodId ? allPeriods.find(period => Number(period.id) === Number(periodId)) : null;
            if (periodId && !selectedPeriod) return res.status(404).json({ error: 'Rapor dönemi bulunamadı' });
            const groupKey = selectedPeriod ? periodGroupKey(selectedPeriod) : (requestedKey || periodGroupKey(allPeriods[0]));
            const [startDate, endDate] = groupKey.split('_');
            const periods = selectedPeriod ? [selectedPeriod] : allPeriods.filter(period => dateKey(period.start_date) === startDate && dateKey(period.end_date) === endDate);
            if (!periods.length) return res.status(404).json({ error: 'Rapor dönemi bulunamadı' });
            const periodIds = periods.map(period => period.id);
            const rows = await reportRepository.listDashboardRows(periodIds);
            const previousPeriods = allPeriods.filter(period => dateKey(period.end_date) < startDate)
                .sort((a, b) => dateKey(b.end_date).localeCompare(dateKey(a.end_date)));
            const previousEnd = previousPeriods[0] ? dateKey(previousPeriods[0].end_date) : null;
            const previousGroupPeriods = previousEnd ? previousPeriods.filter(period => dateKey(period.end_date) === previousEnd) : [];
            const visibleRows = rows;
            const previousRows = previousGroupPeriods.length
                ? await reportRepository.listPreviousRows(previousGroupPeriods.map(period => period.id))
                : [];
            const visiblePreviousRows = previousRows;
            const effectiveDepartment = selectedPeriod ? selectedPeriod.department_id : (departmentQuery === 'all' ? 'all' : Number(departmentQuery));
            const dashboard = buildPolyvalenceDashboard(visibleRows, visiblePreviousRows, effectiveDepartment, positionQuery);
            const taskRows = await reportRepository.listDashboardTasks(periodIds);
            res.json({
                group: {
                    key: groupKey,
                    label: periodDisplayLabel(periods[0]),
                    start_date: startDate,
                    end_date: endDate
                },
                selected_department_id: departmentQuery === 'all' ? 'all' : Number(departmentQuery),
                selected_position: positionQuery,
                period_ids: periodIds,
                tasks: taskRows,
                ...dashboard
            });
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });
    
    router.get('/admin/periods/:id/report', authenticateToken, ensureAdminReport, validate({ params: periodIdParamsSchema }), async (req, res) => {
        try {
            const periodId = toId(req.params.id);
            const period = await reportRepository.getPeriod(periodId);
            if (!period) return res.status(404).json({ error: 'Dönem bulunamadı' });
            if (!await assertReportPeriodAccess(db, req, periodId)) {
                return res.status(403).json({ error: 'Bu bolum raporunu gorme yetkiniz yok' });
            }
            const rows = await reportRepository.listPeriodRows(periodId);
            const assessed = rows.filter(row => row.level_value !== null && row.level_value !== undefined);
            const gaps = assessed.filter(row => row.target_level_snapshot !== null && Number(row.level_value) < Number(row.target_level_snapshot));
            const trainerCount = assessed.filter(row => toBool(row.can_train)).length;
            const average = assessed.length ? assessed.reduce((sum, row) => sum + Number(row.level_value), 0) / assessed.length : null;
            const coverageMap = new Map();
            for (const row of rows.filter(item => item.target_level_snapshot !== null && item.target_level_snapshot !== undefined)) {
                const key = `${row.skill_name_snapshot}:${row.role_name_snapshot || row.position_snapshot || '-'}`;
                if (!coverageMap.has(key)) {
                    coverageMap.set(key, {
                        skill_name: row.skill_name_snapshot,
                        role_name: row.role_name_snapshot || row.position_snapshot || '-',
                        target_level: Number(row.target_level_snapshot),
                        criticality: row.criticality_snapshot || 'normal',
                        min_qualified_count: Number(row.min_qualified_count_snapshot || 1),
                        qualified_count: 0,
                        employee_count: 0
                    });
                }
                const coverage = coverageMap.get(key);
                coverage.employee_count += 1;
                if (row.level_value !== null && Number(row.level_value) >= Number(row.target_level_snapshot)) coverage.qualified_count += 1;
            }
            const skillCoverage = Array.from(coverageMap.values()).map(item => ({
                ...item,
                has_risk: item.criticality === 'critical' && item.qualified_count < item.min_qualified_count
            }));
            const tasks = (await repository.listTaskSummaries(periodId)).map(task => ({
                ...task,
                member_count: Number(task.member_count || 0),
                total: Number(task.total || 0),
                completed: Number(task.completed || 0)
            }));
            res.json({
                period,
                summary: {
                    total: rows.length,
                    assessed: assessed.length,
                    unassessed: rows.length - assessed.length,
                    gap_count: gaps.length,
                    trainer_count: trainerCount,
                    critical_risk_count: skillCoverage.filter(item => item.has_risk).length,
                    average_level: average === null ? null : Number(average.toFixed(2))
                },
                skill_coverage: skillCoverage,
                tasks,
                rows: rows.map(row => ({ ...row, can_train: toBool(row.can_train) }))
            });
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });
    
    router.get('/admin/periods/:id/export.csv', authenticateToken, ensureAdminReport, validate({ params: periodIdParamsSchema, query: reportExportQuerySchema }), async (req, res) => {
        try {
            const periodId = toId(req.params.id);
            const period = await reportRepository.getPeriod(periodId);
            if (!period) return res.status(404).json({ error: 'Dönem bulunamadı' });
            if (!await assertReportPeriodAccess(db, req, periodId)) {
                return res.status(403).json({ error: 'Bu bolum raporunu gorme yetkiniz yok' });
            }
            const rows = await reportRepository.listPeriodRows(periodId);
    
            const mode = req.query.mode === 'matrix' ? 'matrix' : 'detail';
            let csvRows;
            if (mode === 'matrix') {
                const employees = [];
                const employeeSet = new Set();
                const skills = [];
                const skillMap = new Map();
                for (const row of rows) {
                    if (!employeeSet.has(row.employee_id_snapshot)) {
                        employeeSet.add(row.employee_id_snapshot);
                        employees.push({ id: row.employee_id_snapshot, name: row.employee_name_snapshot });
                    }
                    const key = `${row.category_name_snapshot || ''}:${row.skill_name_snapshot}`;
                    if (!skillMap.has(key)) {
                        skillMap.set(key, new Map());
                        skills.push({ key, name: row.skill_name_snapshot, category: row.category_name_snapshot });
                    }
                    skillMap.get(key).set(row.employee_id_snapshot, row.level_value === null ? '' : row.level_value);
                }
                csvRows = [
                    ['Kategori', 'Beceri', ...employees.map(employee => `${employee.name} (#${employee.id})`)],
                    ...skills.map(skill => [skill.category, skill.name, ...employees.map(employee => skillMap.get(skill.key).get(employee.id) ?? '')])
                ];
            } else {
                csvRows = [
                    ['Dönem', 'Bölüm', 'Sicil', 'Çalışan', 'Pozisyon', 'Pozisyon Profili', 'Amir', 'Kategori', 'Beceri', 'Hedef', 'Kritiklik', 'Asgari Yetkin Kişi', 'Seviye', 'Eğitim Verebilir', 'Açıklama', 'Güncelleyen', 'Güncelleme Tarihi'],
                    ...rows.map(row => [period.name, period.department_name, row.employee_id_snapshot, row.employee_name_snapshot,
                        row.position_snapshot, row.role_name_snapshot, row.evaluator_name_snapshot, row.category_name_snapshot,
                        row.skill_name_snapshot, row.target_level_snapshot ?? '', row.criticality_snapshot, row.min_qualified_count_snapshot,
                        row.level_value ?? 'Değerlendirilmedi',
                        toBool(row.can_train) ? 'Evet' : 'Hayır', row.note, row.updated_by_name, row.updated_at])
                ];
            }
            const csv = '\uFEFF' + csvRows.map(row => row.map(csvCell).join(';')).join('\n');
            const fileName = `polivalans-${period.department_name}-${dateKey(period.start_date)}-${mode}.csv`
                .replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ.-]+/g, '-');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
            res.send(csv);
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });
    
    router.get('/admin/periods/:id/audit', authenticateToken, ensureAdminReport, validate({ params: periodIdParamsSchema }), async (req, res) => {
        try {
            const periodId = toId(req.params.id);
            const period = await reportRepository.getPeriod(periodId);
            if (!period) return res.status(404).json({ error: 'Dönem bulunamadı' });
            if (!await assertReportPeriodAccess(db, req, periodId)) {
                return res.status(403).json({ error: 'Bu bölümün tarihçesini görme yetkiniz yok' });
            }
            res.json(await repository.listAuditLogs(periodId));
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });
    
    router.post('/admin/gaps/assign-training', authenticateToken, requirePermission(MANAGE_PERMISSION), validate({ body: gapTrainingAssignmentBodySchema }), async (req, res) => {
        try {
            const skillId = toId(req.body.skill_id);
            const userIds = Array.isArray(req.body.user_ids) ? [...new Set(req.body.user_ids.map(toId).filter(Boolean))] : [];
            const requestedVideoId = toId(req.body.video_id);
            let videoId = requestedVideoId;
            if (!videoId) {
                const link = await reportRepository.findSkillTraining(skillId);
                videoId = link?.video_id || null;
            }
            if (!skillId || !videoId || !userIds.length) return res.status(400).json({ error: 'Beceri, eğitim ve çalışan seçimi zorunludur' });
            const assignmentResult = await assignTrainingUsers(db, {
                userIds,
                videoId,
                dueDate: null
            });
            if (!assignmentResult) return res.status(404).json({ error: 'Eğitim bulunamadı' });
            const assigned = assignmentResult.created.length;
            await addAudit(db, req, { entityType: 'skill', entityId: skillId, action: 'gap_training_assigned', newValue: { video_id: videoId, user_ids: userIds, assigned } });
            res.json({ success: true, assigned });
        } catch (err) {
            res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : err.message });
        }
    });
    

    return router;
};

module.exports = { createReportRouter };
