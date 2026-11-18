const { AppError } = require('../../../core/http');

const createMembershipService = ({ repository, findDepartmentForUser, findRoleForUser }) => {
    const saveTarget = async (body) => {
        const current = await repository.findTarget(body.skill_id, body.role_id);
        await repository.saveTarget(current, body);
        return {
            current,
            updated: await repository.findTarget(body.skill_id, body.role_id)
        };
    };

    const saveMembership = async (body, resolveMembershipDefaults) => {
        const defaults = await resolveMembershipDefaults(null, body.user_id);
        if (!defaults) throw new AppError(404, 'USER_NOT_FOUND', 'Çalışan bulunamadı.');
        const departmentId = body.department_id || defaults.department?.id || null;
        const evaluatorId = body.evaluator_user_id || defaults.evaluator_user_id || null;
        const roleId = body.role_id || defaults.role?.id || null;
        if (!departmentId || !evaluatorId) {
            throw new AppError(
                400,
                'MEMBERSHIP_INCOMPLETE',
                'Çalışan, bölüm ve değerlendirecek amir zorunludur.'
            );
        }
        if (Number(body.user_id) === Number(evaluatorId)) {
            throw new AppError(
                400,
                'SELF_EVALUATION_FORBIDDEN',
                'Çalışan kendi değerlendiricisi olamaz.'
            );
        }
        const isManualOverride = Number(departmentId) !== Number(defaults.department?.id)
            || Number(roleId || 0) !== Number(defaults.role?.id || 0)
            || Number(evaluatorId) !== Number(defaults.evaluator_user_id)
            || !body.is_active;
        const current = await repository.findMembershipByUser(body.user_id);
        await repository.saveMembership(current, {
            userId: body.user_id,
            departmentId,
            roleId,
            evaluatorId,
            isActive: body.is_active,
            isManualOverride
        });
        return {
            current,
            updated: await repository.findMembershipByUser(body.user_id)
        };
    };

    const syncMemberships = async ({ overwrite = false, departmentId = null } = {}) => {
        const { users, departments, roles, memberships } = await repository.loadSyncContext();
        const activeUserIds = new Set(users.map(user => Number(user.id)));
        const existingByUser = new Map(memberships.map(row => [Number(row.user_id), row]));
        const summary = {
            created: 0, updated: 0, skipped: 0,
            missing_department: 0, missing_evaluator: 0, missing_role: 0, details: []
        };

        for (const user of users) {
            const department = findDepartmentForUser(departments, user.department);
            if (departmentId && Number(department?.id) !== Number(departmentId)) continue;
            const role = findRoleForUser(roles, department?.id, user.position);
            const evaluatorId = activeUserIds.has(Number(user.manager_id))
                ? Number(user.manager_id)
                : null;
            const existing = existingByUser.get(Number(user.id));
            const missing = [];
            if (!department) { summary.missing_department += 1; missing.push('department'); }
            if (!evaluatorId) { summary.missing_evaluator += 1; missing.push('evaluator'); }
            if (user.position && !role) { summary.missing_role += 1; missing.push('role'); }
            if (!department || !evaluatorId || Number(user.id) === evaluatorId) {
                summary.skipped += 1;
                summary.details.push({ user_id: user.id, name: user.name, status: 'skipped', missing });
                continue;
            }
            if (existing && !overwrite && Number(existing.is_manual_override) === 1) {
                summary.skipped += 1;
                summary.details.push({ user_id: user.id, name: user.name, status: 'manual_override' });
                continue;
            }
            if (existing) {
                const unchanged = Number(existing.department_id) === Number(department.id)
                    && Number(existing.role_id || 0) === Number(role?.id || 0)
                    && Number(existing.evaluator_user_id) === evaluatorId
                    && Number(existing.is_active) === 1
                    && Number(existing.is_manual_override) === 0;
                if (unchanged) {
                    summary.skipped += 1;
                    summary.details.push({ user_id: user.id, name: user.name, status: 'current' });
                    continue;
                }
                await repository.updateAutomaticMembership(existing.id, {
                    departmentId: department.id,
                    roleId: role?.id || null,
                    evaluatorId
                });
                summary.updated += 1;
                continue;
            }
            try {
                await repository.insertAutomaticMembership({
                    userId: user.id,
                    departmentId: department.id,
                    roleId: role?.id || null,
                    evaluatorId
                });
                summary.created += 1;
            } catch (error) {
                if (!/unique|duplicate|constraint/i.test(String(error?.message || ''))) throw error;
                summary.skipped += 1;
            }
        }
        return summary;
    };

    const resetToDefaults = async (membershipId, resolveMembershipDefaults) => {
        const current = await repository.findMembershipById(membershipId);
        if (!current) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Eşleşme bulunamadı.');
        const defaults = await resolveMembershipDefaults(null, current.user_id);
        if (!defaults?.department || !defaults.evaluator_user_id) {
            throw new AppError(
                409,
                'MEMBERSHIP_DEFAULTS_INCOMPLETE',
                'Kullanıcının bölümü veya üst amiri eksik olduğu için varsayılana dönülemiyor.'
            );
        }
        if (Number(current.user_id) === Number(defaults.evaluator_user_id)) {
            throw new AppError(409, 'SELF_EVALUATION_FORBIDDEN', 'Çalışan kendi değerlendiricisi olamaz.');
        }
        await repository.resetMembership(membershipId, {
            departmentId: defaults.department.id,
            roleId: defaults.role?.id || null,
            evaluatorId: defaults.evaluator_user_id
        });
        return { current, updated: await repository.findMembershipById(membershipId) };
    };

    return { saveTarget, saveMembership, syncMemberships, resetToDefaults };
};

module.exports = { createMembershipService };
