const roundPercent = (value, total) => total ? Math.round((Number(value || 0) / Number(total)) * 100) : 0;

const buildPolyvalenceDashboard = (rows, previousRows = [], scopeDepartmentId = 'all', positionFilter = 'all') => {
    const departmentRows = scopeDepartmentId === 'all'
        ? rows
        : rows.filter(row => Number(row.department_id) === Number(scopeDepartmentId));
    const departmentPreviousRows = scopeDepartmentId === 'all'
        ? previousRows
        : previousRows.filter(row => Number(row.department_id) === Number(scopeDepartmentId));
    const positionName = (row) => row.role_name_snapshot || row.position_snapshot || 'Pozisyon yok';
    const positions = Array.from(new Set(departmentRows.map(positionName))).map(name => ({ key: name, name }));
    const scopedRows = positionFilter === 'all'
        ? departmentRows
        : departmentRows.filter(row => positionName(row) === positionFilter);
    const scopedPreviousRows = positionFilter === 'all'
        ? departmentPreviousRows
        : departmentPreviousRows.filter(row => positionName(row) === positionFilter);
    const targetRows = scopedRows.filter(row => row.target_level_snapshot !== null && row.target_level_snapshot !== undefined);
    const previousTargetRows = scopedPreviousRows.filter(row => row.target_level_snapshot !== null && row.target_level_snapshot !== undefined);
    const isMet = (row) => row.level_value !== null && row.level_value !== undefined && Number(row.level_value) >= Number(row.target_level_snapshot);
    const metCount = targetRows.filter(isMet).length;
    const previousMetCount = previousTargetRows.filter(isMet).length;

    const memberMap = new Map();
    for (const row of scopedRows) {
        if (!memberMap.has(row.period_member_id)) {
            memberMap.set(row.period_member_id, {
                total: 0,
                completed: 0
            });
        }
        const member = memberMap.get(row.period_member_id);
        member.total += 1;
        if (row.level_value !== null && row.level_value !== undefined) member.completed += 1;
    }
    const members = Array.from(memberMap.values());
    const completedEmployees = members.filter(member => member.total > 0 && member.completed === member.total).length;

    const buildSkillCoverage = (sourceRows) => {
        const map = new Map();
        for (const row of sourceRows.filter(item => item.target_level_snapshot !== null && item.target_level_snapshot !== undefined)) {
            const key = `${row.department_id}:${row.skill_name_snapshot}:${row.role_name_snapshot || row.position_snapshot || '-'}`;
            if (!map.has(key)) {
                map.set(key, {
                    department_id: row.department_id,
                    department_name: row.department_name,
                    skill_name: row.skill_name_snapshot,
                    role_name: row.role_name_snapshot || row.position_snapshot || '-',
                    target_level: Number(row.target_level_snapshot),
                    criticality: row.criticality_snapshot || 'normal',
                    min_qualified_count: Number(row.min_qualified_count_snapshot || 1),
                    qualified_count: 0,
                    employee_count: 0,
                    qualified_names: []
                });
            }
            const item = map.get(key);
            item.employee_count += 1;
            if (isMet(row)) {
                item.qualified_count += 1;
                item.qualified_names.push(row.employee_name_snapshot);
            }
        }
        return Array.from(map.values()).map(item => ({
            ...item,
            has_risk: item.criticality === 'critical' && (item.qualified_count <= 1 || item.qualified_count < item.min_qualified_count),
            owner_name: item.qualified_count === 1 ? item.qualified_names[0] : null
        }));
    };

    const skillCoverage = buildSkillCoverage(scopedRows);
    const heatMap = new Map();
    const categorySet = new Set();
    const heatRows = positionFilter === 'all' ? departmentRows : scopedRows;
    for (const row of heatRows.filter(item => item.target_level_snapshot !== null && item.target_level_snapshot !== undefined)) {
        const category = row.category_name_snapshot || 'Genel';
        const position = positionName(row);
        categorySet.add(category);
        const key = `${position}:${category}`;
        if (!heatMap.has(key)) heatMap.set(key, { department_id: position, department_name: position, category, total: 0, met: 0 });
        const cell = heatMap.get(key);
        cell.total += 1;
        if (isMet(row)) cell.met += 1;
    }
    const heatmap = {
        departments: Array.from(new Set(heatRows.map(positionName))).map(name => ({ id: name, name })),
        categories: Array.from(categorySet),
        cells: Array.from(heatMap.values()).map(item => ({ ...item, score: roundPercent(item.met, item.total) }))
    };

    const departmentScores = new Map();
    for (const row of heatRows.filter(item => item.target_level_snapshot !== null && item.target_level_snapshot !== undefined)) {
        const position = positionName(row);
        if (!departmentScores.has(position)) {
            departmentScores.set(position, { department_id: position, name: position, total: 0, met: 0 });
        }
        const item = departmentScores.get(position);
        item.total += 1;
        if (isMet(row)) item.met += 1;
    }
    const department_comparison = Array.from(departmentScores.values())
        .map(item => ({ department_id: item.department_id, name: item.name, score: roundPercent(item.met, item.total) }))
        .sort((a, b) => b.score - a.score);

    const employeeMap = new Map();
    for (const row of targetRows) {
        if (!employeeMap.has(row.period_member_id)) {
            employeeMap.set(row.period_member_id, {
                employee_id: row.employee_id_snapshot,
                name: row.employee_name_snapshot,
                position: row.position_snapshot,
                department_name: row.department_name,
                target_total: 0,
                completed: 0
            });
        }
        const employee = employeeMap.get(row.period_member_id);
        employee.target_total += 1;
        if (isMet(row)) employee.completed += 1;
    }
    const top_employees = Array.from(employeeMap.values())
        .map(item => ({ ...item, score: roundPercent(item.completed, item.target_total) }))
        .sort((a, b) => b.completed - a.completed || b.score - a.score || String(a.name).localeCompare(String(b.name), 'tr'))
        .slice(0, 5);

    const skillMap = new Map();
    for (const row of targetRows) {
        const key = `${scopeDepartmentId === 'all' ? row.department_id : 'scope'}:${row.skill_name_snapshot}`;
        if (!skillMap.has(key)) {
            skillMap.set(key, {
                skill_name: row.skill_name_snapshot,
                category: row.category_name_snapshot || 'Genel',
                department_name: scopeDepartmentId === 'all' ? row.department_name : null,
                total: 0,
                met: 0
            });
        }
        const item = skillMap.get(key);
        item.total += 1;
        if (isMet(row)) item.met += 1;
    }
    const development_skills = Array.from(skillMap.values())
        .map(item => ({ ...item, coverage: roundPercent(item.met, item.total) }))
        .filter(item => item.coverage < 60)
        .sort((a, b) => a.coverage - b.coverage)
        .slice(0, 5);

    const currentRate = roundPercent(metCount, targetRows.length);
    const previousRate = roundPercent(previousMetCount, previousTargetRows.length);
    const avgSkill = members.length ? Number((metCount / members.length).toFixed(1)) : 0;
    const previousMemberIds = new Set(scopedPreviousRows.map(row => row.period_member_id));
    const previousAvgSkill = previousMemberIds.size ? Number((previousMetCount / previousMemberIds.size).toFixed(1)) : null;

    return {
        departments: Array.from(new Set(departmentRows.map(row => row.department_id))).map(id => {
            const row = departmentRows.find(item => Number(item.department_id) === Number(id));
            return { id, name: row?.department_name || '-' };
        }),
        positions,
        summary: {
            polyvalence_rate: currentRate,
            polyvalence_delta: previousTargetRows.length ? currentRate - previousRate : null,
            average_skill_per_employee: avgSkill,
            average_skill_delta: previousAvgSkill === null ? null : Number((avgSkill - previousAvgSkill).toFixed(1)),
            critical_risk_count: skillCoverage.filter(item => item.has_risk).length,
            completion_percent: roundPercent(completedEmployees, members.length),
            completed_employees: completedEmployees,
            total_employees: members.length
        },
        operation_risks: skillCoverage.filter(item => item.has_risk).slice(0, 6),
        heatmap,
        department_comparison,
        top_employees,
        development_skills
    };
};

module.exports = {
    buildPolyvalenceDashboard
};
