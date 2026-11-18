const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');

const normalizeFieldKey = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `field_${Date.now()}`;

const safeParseAnswers = value => {
    try {
        return typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
    } catch {
        return {};
    }
};

const prepareRequestType = body => ({
    name: body.name.trim(),
    description: body.description || '',
    isActive: body.is_active ?? true,
    orderIndex: Number(body.order_index) || 0,
    fields: (body.fields || [])
        .filter(field => field.label?.trim())
        .map((field, index) => ({
            label: field.label.trim(),
            key: normalizeFieldKey(field.field_key || field.label),
            type: field.field_type || 'text',
            isRequired: Boolean(field.is_required),
            orderIndex: Number(field.order_index) || index + 1,
            placeholder: field.placeholder || ''
        }))
});

const createDocumentService = repository => ({
    async getRequestTypes(activeOnly) {
        const { types, fields } = await repository.getRequestTypes(activeOnly);
        return types.map(type => ({
            ...type,
            fields: fields.filter(field => Number(field.type_id) === Number(type.id))
        }));
    },
    async listDocuments(userId, query) {
        const pagination = parsePagination(query);
        const sortColumn = query.sort === 'title' ? 'title' : 'upload_date';
        const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
        const [total, rows] = await Promise.all([
            repository.countDocuments(userId),
            repository.listDocuments(userId, pagination, sortColumn, sortDirection)
        ]);
        return paginatedResponse(rows, total?.total, pagination.page, pagination.pageSize);
    },
    async listUserOptions(query) {
        const pagination = parsePagination(query);
        const { total, rows } = await repository.listUserOptions({
            search: query.search,
            pagination
        });
        return paginatedResponse(rows, total, pagination.page, pagination.pageSize);
    },
    async createRequestType(body) {
        return repository.createRequestType(prepareRequestType(body));
    },
    async updateRequestType(id, body) {
        await repository.updateRequestType(id, prepareRequestType(body));
    },
    async listEmployeeRequests(userId, query) {
        const pagination = parsePagination(query);
        const sortColumns = {
            created_at: 'r.created_at',
            status: 'r.status',
            type_name: 't.name'
        };
        const sortColumn = sortColumns[query.sort] || sortColumns.created_at;
        const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
        const [total, rows] = await Promise.all([
            repository.countEmployeeRequests(userId),
            repository.listEmployeeRequests(userId, pagination, sortColumn, sortDirection)
        ]);
        return paginatedResponse(
            rows.map(row => ({ ...row, answers: safeParseAnswers(row.answers_json) })),
            total?.total,
            pagination.page,
            pagination.pageSize
        );
    },
    async createDocumentRequest(userId, body) {
        const type = await repository.getRequestType(body.type_id);
        if (!type || type.is_active === 0 || type.is_active === false) {
            throw new AppError(400, 'DOCUMENT_TYPE_INACTIVE', 'Belge türü aktif değil');
        }
        const fields = await repository.getRequestFields(body.type_id);
        for (const field of fields) {
            if ((field.is_required === 1 || field.is_required === true)
                && !String(body.answers[field.field_key] || '').trim()) {
                throw new AppError(400, 'DOCUMENT_FIELD_REQUIRED', `${field.label} alanı zorunludur`);
            }
        }
        return repository.createDocumentRequest({
            userId,
            typeId: body.type_id,
            answers: body.answers
        });
    },
    async listAdminRequests(query) {
        const pagination = parsePagination(query);
        const sortColumns = {
            created_at: 'r.created_at',
            status: 'r.status',
            type_name: 't.name',
            user_name: 'u.name'
        };
        const { total, rows } = await repository.listAdminRequests({
            query,
            pagination,
            sortColumn: sortColumns[query.sort] || sortColumns.created_at,
            sortDirection: query.order === 'asc' ? 'ASC' : 'DESC'
        });
        return paginatedResponse(
            rows.map(row => ({ ...row, answers: safeParseAnswers(row.answers_json) })),
            total,
            pagination.page,
            pagination.pageSize
        );
    },
    updateRequestStatus(id, body, adminId) {
        return repository.updateRequestStatus(id, {
            status: body.status,
            hrNote: body.hr_note || '',
            adminId
        });
    }
});

module.exports = { createDocumentService };
