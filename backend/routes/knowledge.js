const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const {
    categoryBodySchema,
    categoryListQuerySchema,
    idParamsSchema,
    itemBodySchema,
    itemListQuerySchema
} = require('../modules/knowledge/knowledgeSchemas');
const { createKnowledgeRepository } = require('../modules/knowledge/knowledgeRepository');
const { createKnowledgeService } = require('../modules/knowledge/knowledgeService');
const { createKnowledgeController } = require('../modules/knowledge/knowledgeController');

module.exports = (db, mode = 'user') => {
    const router = express.Router();
    const isAdminMode = mode === 'admin';
    const controller = createKnowledgeController(
        createKnowledgeService(createKnowledgeRepository(db))
    );

    router.use(authenticateToken);
    if (isAdminMode) router.use(requirePermission('manage_knowledge_portal'));
    router.get(
        '/categories',
        validate({ query: categoryListQuerySchema }),
        asyncHandler(controller.listCategories)
    );
    router.get(
        '/categories/:id/items',
        validate({ params: idParamsSchema, query: itemListQuerySchema }),
        asyncHandler(controller.listItems)
    );
    if (!isAdminMode) return router;

    router.post(
        '/categories',
        validate({ body: categoryBodySchema }),
        asyncHandler(controller.createCategory)
    );
    router.put(
        '/categories/:id',
        validate({ params: idParamsSchema, body: categoryBodySchema }),
        asyncHandler(controller.updateCategory)
    );
    router.delete(
        '/categories/:id',
        validate({ params: idParamsSchema }),
        asyncHandler(controller.deleteCategory)
    );
    router.post(
        '/items',
        validate({ body: itemBodySchema }),
        asyncHandler(controller.createItem)
    );
    router.put(
        '/items/:id',
        validate({ params: idParamsSchema, body: itemBodySchema }),
        asyncHandler(controller.updateItem)
    );
    router.delete(
        '/items/:id',
        validate({ params: idParamsSchema }),
        asyncHandler(controller.deleteItem)
    );

    return router;
};
