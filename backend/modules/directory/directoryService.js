const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');

function createDirectoryService(repository, { now = () => new Date() } = {}) {
    return {
        async list(query) {
            const pagination = parsePagination(query);
            const result = await repository.list({ query, pagination });
            return paginatedResponse(
                result.items,
                result.total,
                pagination.page,
                pagination.pageSize
            );
        },

        async listBirthdays(query) {
            const pagination = parsePagination(query);
            const today = now();
            const result = await repository.listBirthdays({
                month: today.getMonth() + 1,
                day: today.getDate(),
                pagination
            });
            return paginatedResponse(
                result.items,
                result.total,
                pagination.page,
                pagination.pageSize
            );
        },

        async getProfile(id, requester) {
            const includeContact = requester.role === 'admin' || requester.id === id;
            const user = await repository.findById(id, includeContact);
            if (!user) {
                throw new AppError(404, 'DIRECTORY_USER_NOT_FOUND', 'Çalışan bulunamadı.');
            }
            const [badges, educationEntries, interests] = await Promise.all([
                repository.listBadges(id),
                repository.listEducation(id),
                repository.listInterests(id)
            ]);
            user.badges = badges;
            user.education_entries = educationEntries.map(entry => ({
                ...entry,
                is_current: Boolean(entry.is_current)
            }));
            user.skill_tags = interests.filter(item => item.kind === 'skill').map(item => item.label);
            user.hobby_tags = interests.filter(item => item.kind === 'hobby').map(item => item.label);
            return user;
        }
    };
}

module.exports = { createDirectoryService };
