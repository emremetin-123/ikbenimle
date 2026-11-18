const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');

function createKnowledgeService(repository) {
    const ensureCategory = async (id) => {
        const category = await repository.findCategory(id);
        if (!category) {
            throw new AppError(404, 'KNOWLEDGE_CATEGORY_NOT_FOUND', 'Kategori bulunamadı.');
        }
        return category;
    };

    return {
        async listCategories(query) {
            const pagination = parsePagination(query);
            const result = await repository.listCategories({ query, pagination });
            return paginatedResponse(
                result.items,
                result.total,
                pagination.page,
                pagination.pageSize
            );
        },
        async listItems(categoryId, query) {
            const category = await ensureCategory(categoryId);
            const pagination = parsePagination(query);
            const [subCategories, result] = await Promise.all([
                repository.listSubCategories(categoryId),
                repository.listItems({ categoryId, query, pagination })
            ]);
            return {
                category,
                sub_categories: subCategories.map(row => row.sub_category),
                ...paginatedResponse(
                    result.items.map(row => ({
                        ...row,
                        is_featured: Boolean(row.is_featured)
                    })),
                    result.total,
                    pagination.page,
                    pagination.pageSize
                )
            };
        },
        async createCategory(body) {
            const result = await repository.createCategory(body);
            return { id: result.lastID, ...body };
        },
        async updateCategory(id, body) {
            const result = await repository.updateCategory(id, body);
            if (!result.changes) {
                throw new AppError(404, 'KNOWLEDGE_CATEGORY_NOT_FOUND', 'Kategori bulunamadı.');
            }
        },
        async deleteCategory(id) {
            await ensureCategory(id);
            await repository.deleteCategory(id);
        },
        async createItem(body) {
            await ensureCategory(body.category_id);
            const result = await repository.createItem(body);
            return { id: result.lastID, ...body };
        },
        async updateItem(id, body) {
            await ensureCategory(body.category_id);
            const result = await repository.updateItem(id, body);
            if (!result.changes) {
                throw new AppError(404, 'KNOWLEDGE_ITEM_NOT_FOUND', 'Bilgi kaydı bulunamadı.');
            }
        },
        async deleteItem(id) {
            const result = await repository.deleteItem(id);
            if (!result.changes) {
                throw new AppError(404, 'KNOWLEDGE_ITEM_NOT_FOUND', 'Bilgi kaydı bulunamadı.');
            }
        }
    };
}

module.exports = { createKnowledgeService };
