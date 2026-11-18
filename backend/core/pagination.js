const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const positiveInteger = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parsePagination = (query = {}) => {
    const page = positiveInteger(query.page, 1);
    const pageSize = Math.min(
        positiveInteger(query.pageSize, DEFAULT_PAGE_SIZE),
        MAX_PAGE_SIZE
    );
    return {
        page,
        pageSize,
        startRow: ((page - 1) * pageSize) + 1,
        endRow: page * pageSize
    };
};

const paginatedResponse = (items, total, page, pageSize) => ({
    items,
    pagination: {
        page,
        pageSize,
        total: Number(total || 0),
        totalPages: Math.ceil(Number(total || 0) / pageSize)
    }
});

module.exports = {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    parsePagination,
    paginatedResponse
};
