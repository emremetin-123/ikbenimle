const { AppError } = require('../../../core/http');

const catalogColumns = {
    department: 'id, name, source_department_name, is_archived, archived_at, archived_by, created_at, updated_at',
    role: 'id, department_id, name, is_archived, archived_at, archived_by, created_at, updated_at',
    category: 'id, department_id, name, sort_order, is_archived, archived_at, archived_by, created_at, updated_at',
    skill: 'id, department_id, category_id, code, name, description, sort_order, is_archived, archived_at, archived_by, archive_reason, created_at, updated_at'
};

const isConflict = (error) =>
    /unique|duplicate|constraint/i.test(String(error?.message || ''));

const route = (handler) => async (req, res, next) => {
    try {
        return await handler(req, res);
    } catch (error) {
        if (isConflict(error)) {
            return next(new AppError(
                409,
                'RESOURCE_CONFLICT',
                'Aynı tanıma sahip etkin bir kayıt zaten mevcut.'
            ));
        }
        return next(error);
    }
};

const ensureFound = (record, label) => {
    if (!record) throw new AppError(404, 'NOT_FOUND', `${label} bulunamadı.`);
    return record;
};

module.exports = { catalogColumns, route, ensureFound };
