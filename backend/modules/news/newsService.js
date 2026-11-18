const fs = require('fs');
const path = require('path');
const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');

function createNewsService(repository, media) {
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
        async get(id) {
            const row = await repository.findById(id);
            if (!row) throw new AppError(404, 'NEWS_NOT_FOUND', 'Haber bulunamadı.');
            return row;
        },
        async create(body, file, userId) {
            let imageUrl = null;
            let imagePublicId = null;
            if (file) {
                if (media.useCloudinary) {
                    const uploaded = await media.uploadToCloudinary(file.buffer, 'news');
                    imageUrl = uploaded.url;
                    imagePublicId = uploaded.public_id;
                } else {
                    imageUrl = `/uploads/news/${file.filename}`;
                }
            }
            await repository.create({
                title: body.title,
                content: body.content,
                imageUrl,
                imagePublicId,
                createdBy: userId
            });
        },
        async remove(id) {
            const { row, changes } = await repository.remove(id);
            if (!changes) throw new AppError(404, 'NEWS_NOT_FOUND', 'Haber bulunamadı.');
            if (media.useCloudinary && row?.image_public_id) {
                await media.deleteFromCloudinary(row.image_public_id);
            } else if (row?.image_url?.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, '..', '..', row.image_url.replace(/^\//, ''));
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
        }
    };
}

module.exports = { createNewsService };
