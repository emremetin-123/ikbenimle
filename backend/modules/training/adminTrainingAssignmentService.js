const { parsePagination, paginatedResponse } = require('../../core/pagination');
const { AppError } = require('../../core/http');

const createAdminTrainingAssignmentService = repository => ({
    async listStats(query) {
        const pagination = parsePagination(query);
        const { items, summary } = await repository.listStats(query, pagination);
        return {
            ...paginatedResponse(items, summary?.total, pagination.page, pagination.pageSize),
            summary: {
                total: Number(summary?.total || 0),
                completed: Number(summary?.completed || 0),
                cancelled: Number(summary?.cancelled || 0),
                overdue: Number(summary?.overdue || 0),
                passed: Number(summary?.passed || 0)
            }
        };
    },

    async getStatsOptions() {
        const rows = await repository.listStatsDepartments();
        return { departments: rows.map(item => item.department) };
    },

    async getUserFilters() {
        const [departments, positions] = await Promise.all([
            repository.listActiveDepartments(), repository.listActivePositions()
        ]);
        return {
            departments: departments.map(item => item.department),
            positions: positions.map(item => item.position)
        };
    },

    async listUserOptions(query) {
        const pagination = parsePagination(query);
        const result = await repository.listUserOptions(query, pagination);
        return paginatedResponse(result.items, result.total, pagination.page, pagination.pageSize);
    },

    async cancelAssignment(assignmentId, userId) {
        const result = await repository.cancelAssignment(assignmentId, userId);
        if (!result.changes) {
            throw new AppError(409, 'ASSIGNMENT_ALREADY_CANCELLED', 'Atama zaten kaldırılmış veya bulunamadı.');
        }
        return result;
    }
});

module.exports = { createAdminTrainingAssignmentService };
