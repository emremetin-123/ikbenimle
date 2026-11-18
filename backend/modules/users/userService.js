const { parsePagination, paginatedResponse } = require('../../core/pagination');

const normalizeFilter = (value, maxLength = 255) => {
    const normalized = String(value || '').trim();
    return normalized ? normalized.slice(0, maxLength) : '';
};

const createUserService = (repository) => ({
    async list(query) {
        const pagination = parsePagination(query);
        const filters = {
            search: normalizeFilter(query.search),
            department: normalizeFilter(query.department),
            status: ['active', 'passive'].includes(query.status) ? query.status : '',
            sort: ['name', 'employee_id', 'department', 'position'].includes(query.sort)
                ? query.sort
                : 'name',
            order: query.order === 'desc' ? 'desc' : 'asc'
        };

        const result = await repository.list(filters, pagination);
        return paginatedResponse(
            result.items,
            result.total,
            pagination.page,
            pagination.pageSize
        );
    },

    async listOptions(query) {
        const pagination = parsePagination(query);
        const result = await repository.listOptions(pagination, normalizeFilter(query.search));
        return paginatedResponse(
            result.items,
            result.total,
            pagination.page,
            pagination.pageSize
        );
    },

    listFormOptions: () => repository.listFormOptions()
});

module.exports = {
    createUserService
};
