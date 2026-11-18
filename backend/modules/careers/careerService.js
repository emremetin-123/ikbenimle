const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');

function createCareerService(repository) {
    const page = async (loader, query) => {
        const pagination = parsePagination(query);
        const result = await loader(pagination);
        return paginatedResponse(result.items, result.total, pagination.page, pagination.pageSize);
    };
    return {
        listJobs: (query, options) => page(
            pagination => repository.listJobs({ query, pagination, ...options }),
            query
        ),
        async getJob(id, userId) {
            const job = await repository.findActiveJob(id);
            if (!job) throw new AppError(404, 'CAREER_JOB_NOT_FOUND', 'İlan bulunamadı.');
            const application = await repository.findApplication(id, userId);
            return { ...job, user_applied: Boolean(application) };
        },
        async apply(jobId, userId) {
            const job = await repository.findActiveJob(jobId);
            if (!job) {
                throw new AppError(404, 'CAREER_JOB_NOT_FOUND', 'Geçerli ve aktif bir ilan bulunamadı.');
            }
            if (await repository.findApplication(jobId, userId)) {
                throw new AppError(409, 'CAREER_ALREADY_APPLIED', 'Bu ilana zaten başvurdunuz.');
            }
            try {
                await repository.createApplication(jobId, userId);
            } catch (error) {
                if (String(error.message || '').includes('UNIQUE')) {
                    throw new AppError(409, 'CAREER_ALREADY_APPLIED', 'Bu ilana zaten başvurdunuz.');
                }
                throw error;
            }
        },
        listMine: (userId, query) => page(
            pagination => repository.listMyApplications({ userId, query, pagination }),
            query
        ),
        async createJob(body, userId) {
            const result = await repository.createJob(body, userId);
            return result.lastID;
        },
        async updateJob(id, body) {
            if (!(await repository.updateJob(id, body)).changes) {
                throw new AppError(404, 'CAREER_JOB_NOT_FOUND', 'İlan bulunamadı.');
            }
        },
        async deleteJob(id) {
            if (!await repository.deleteJob(id)) {
                throw new AppError(404, 'CAREER_JOB_NOT_FOUND', 'İlan bulunamadı.');
            }
        },
        listApplications: (jobId, query) => page(
            pagination => repository.listApplications({ jobId, query, pagination }),
            query
        ),
        async updateApplicationStatus(id, status) {
            if (!(await repository.updateApplicationStatus(id, status)).changes) {
                throw new AppError(404, 'CAREER_APPLICATION_NOT_FOUND', 'Başvuru bulunamadı.');
            }
        }
    };
}
module.exports = { createCareerService };
