const MANAGE_PERMISSION = 'manage_polyvalence';
const REPORT_PERMISSION = 'view_polyvalence_reports';
const { parsePagination, paginatedResponse } = require('../../core/pagination');

const toBool = value => (
    value === true || value === 1 || value === '1' || value === 'true'
);
const toId = value => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const dateKey = value => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
};
const addMonths = (dateValue, months) => {
    const date = new Date(`${dateKey(dateValue)}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + Number(months || 0));
    return date.toISOString().slice(0, 10);
};
const addDays = (dateValue, days) => {
    const date = new Date(`${dateKey(dateValue)}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
};
const buildPeriodName = (startDate, frequencyMonths) => {
    const start = new Date(`${dateKey(startDate)}T12:00:00Z`);
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + 1;
    const frequency = Number(frequencyMonths || 12);
    if (frequency === 12) return `${year} Yıllık Değerlendirmesi`;
    if (frequency === 6) {
        return `${year} ${month <= 6 ? '1. Yarıyıl' : '2. Yarıyıl'} Değerlendirmesi`;
    }
    if (frequency === 3) {
        return `${year} ${Math.floor((month - 1) / 3) + 1}. Çeyrek Değerlendirmesi`;
    }
    return `${year} ${frequency} Aylık Değerlendirme`;
};
const normalizeText = value => (
    String(value || '').trim().toLocaleLowerCase('tr-TR')
);
const findDepartmentForUser = (departments, sourceDepartment) => {
    const normalized = normalizeText(sourceDepartment);
    if (!normalized) return null;
    return departments.find(department => (
        !toBool(department.is_archived)
        && (
            normalizeText(department.source_department_name) === normalized
            || normalizeText(department.name) === normalized
        )
    )) || null;
};
const findRoleForUser = (roles, departmentId, position) => {
    const normalized = normalizeText(position);
    if (!departmentId || !normalized) return null;
    return roles.find(role => (
        !toBool(role.is_archived)
        && Number(role.department_id) === Number(departmentId)
        && normalizeText(role.name) === normalized
    )) || null;
};
const parsePermissions = user => {
    try {
        const permissions = typeof user?.permissions === 'string'
            ? JSON.parse(user.permissions)
            : user?.permissions;
        return Array.isArray(permissions) ? permissions : [];
    } catch {
        return [];
    }
};
const canManage = user => (
    user?.role === 'admin'
    || parsePermissions(user).includes(MANAGE_PERMISSION)
);
const canReport = user => (
    canManage(user) || parsePermissions(user).includes(REPORT_PERMISSION)
);
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

function createPolyvalenceContextService(repository) {
    const ensureUserPoolDefinitions = async () => {
        const [users, departments, roles] = await Promise.all([
            repository.listUserPoolSource(),
            repository.listDepartments(),
            repository.listRoles()
        ]);
        const departmentByName = new Map();
        for (const department of departments) {
            departmentByName.set(normalizeText(department.name), department);
            if (department.source_department_name) {
                departmentByName.set(
                    normalizeText(department.source_department_name),
                    department
                );
            }
        }
        const roleByKey = new Map(roles.map(role => [
            `${role.department_id}:${normalizeText(role.name)}`,
            role
        ]));
        const userDepartments = [...new Set(users
            .map(item => String(item.department || '').trim())
            .filter(Boolean))];
        for (const rawDepartment of userDepartments) {
            const key = normalizeText(rawDepartment);
            const existing = departmentByName.get(key);
            if (existing) {
                if (toBool(existing.is_archived)) {
                    await repository.restoreDepartment(existing.id);
                    existing.is_archived = 0;
                }
                continue;
            }
            departmentByName.set(
                key,
                await repository.createDepartment(rawDepartment)
            );
        }
        for (const item of users) {
            const rawDepartment = String(item.department || '').trim();
            const rawPosition = String(item.position || '').trim();
            if (!rawDepartment || !rawPosition) continue;
            const department = departmentByName.get(normalizeText(rawDepartment));
            if (!department) continue;
            const roleKey = `${department.id}:${normalizeText(rawPosition)}`;
            const existing = roleByKey.get(roleKey);
            if (existing) {
                if (toBool(existing.is_archived)) {
                    await repository.restoreRole(existing.id);
                    existing.is_archived = 0;
                }
                continue;
            }
            await repository.createRole(department.id, rawPosition);
            roleByKey.set(roleKey, {
                department_id: department.id,
                name: rawPosition,
                is_archived: 0
            });
        }
    };

    return {
        ensureUserPoolDefinitions,
        async getSetup(query = {}) {
            await ensureUserPoolDefinitions();
            if (query.resource === 'users' || query.resource === 'memberships') {
                const pagination = parsePagination(query);
                const result = query.resource === 'users'
                    ? await repository.listSetupUsers(pagination, query.search)
                    : await repository.listSetupMemberships(pagination, query.search);
                return paginatedResponse(
                    result.items,
                    result.total,
                    pagination.page,
                    pagination.pageSize
                );
            }
            return repository.loadSetup({ includeLargeCollections: query.includeLarge !== 'false' });
        },
        async resolveMembershipDefaults(userId) {
            const [user, departments, roles] = await Promise.all([
                repository.findUser(userId),
                repository.listDepartments('is_archived, name'),
                repository.listRoles('is_archived, name')
            ]);
            if (!user) return null;
            const department = findDepartmentForUser(departments, user.department);
            const role = findRoleForUser(roles, department?.id, user.position);
            return {
                user,
                department,
                role,
                evaluator_user_id: user.manager_id || null,
                missing: {
                    department: !department,
                    evaluator: !user.manager_id,
                    role: Boolean(user.position) && !role
                }
            };
        },
        async loadReportScopeDepartment(user) {
            if (canManage(user)) return 'all';
            const currentUser = await repository.findUserDepartment(user.id);
            const rawDepartment = currentUser?.department || user?.department;
            if (!normalizeText(rawDepartment)) return null;
            const departments = (await repository.listDepartments('id'))
                .filter(item => !toBool(item.is_archived));
            return findDepartmentForUser(departments, rawDepartment);
        },
        async assertReportPeriodAccess(user, periodId) {
            if (canManage(user)) return true;
            const department = await this.loadReportScopeDepartment(user);
            if (!department) return false;
            return Boolean(await repository.findPeriodForDepartment(
                periodId,
                department.id
            ));
        },
        addAudit(req, data) {
            return repository.insertAudit({
                ...data,
                oldValue: data.oldValue ?? null,
                newValue: data.newValue ?? null,
                actorUserId: req.user?.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
        }
    };
}

module.exports = {
    MANAGE_PERMISSION,
    addDays,
    addMonths,
    buildPeriodName,
    canManage,
    canReport,
    createPolyvalenceContextService,
    csvCell,
    dateKey,
    findDepartmentForUser,
    findRoleForUser,
    toBool,
    toId
};
