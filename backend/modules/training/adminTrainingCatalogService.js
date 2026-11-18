const { parsePagination, paginatedResponse } = require('../../core/pagination');
const { normalizeContentType, safeJson } = require('./trainingContentService');

const createAdminTrainingCatalogService = repository => ({
    async listVideos(query) {
        const pagination = parsePagination(query);
        const result = await repository.listVideos(query, pagination);
        return paginatedResponse(result.items, result.total, pagination.page, pagination.pageSize);
    },

    async listOptions(query) {
        const pagination = parsePagination(query);
        const result = await repository.listOptions(query.search, pagination);
        return paginatedResponse(result.items, result.total, pagination.page, pagination.pageSize);
    },

    async getVideo(videoId) {
        const video = await repository.findVideo(videoId);
        if (!video) return null;
        const lessons = await repository.listVideoLessons(videoId);
        return {
            video,
            lessons: lessons.map(lesson => ({
                id: lesson.id,
                module_id: lesson.module_id,
                module_title: lesson.module_title || lesson.title,
                module_description: lesson.module_description || '',
                module_index: lesson.module_index ?? lesson.order_index,
                title: lesson.title || '',
                url: lesson.url || '',
                description: lesson.description || '',
                content_type: normalizeContentType(lesson.content_type),
                content_metadata: safeJson(lesson.content_metadata, {}),
                required_seconds: lesson.required_seconds || '',
                required_percent: lesson.required_percent || '',
                quizData: safeJson(lesson.quiz_data, null)
            }))
        };
    }
});

module.exports = { createAdminTrainingCatalogService };
