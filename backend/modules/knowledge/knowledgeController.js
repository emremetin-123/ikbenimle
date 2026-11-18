function createKnowledgeController(service) {
    return {
        async listCategories(req, res) {
            res.json(await service.listCategories(req.query));
        },
        async listItems(req, res) {
            res.json(await service.listItems(req.params.id, req.query));
        },
        async createCategory(req, res) {
            res.status(201).json(await service.createCategory(req.body));
        },
        async updateCategory(req, res) {
            await service.updateCategory(req.params.id, req.body);
            res.json({ success: true });
        },
        async deleteCategory(req, res) {
            await service.deleteCategory(req.params.id);
            res.json({ success: true });
        },
        async createItem(req, res) {
            res.status(201).json(await service.createItem(req.body));
        },
        async updateItem(req, res) {
            await service.updateItem(req.params.id, req.body);
            res.json({ success: true });
        },
        async deleteItem(req, res) {
            await service.deleteItem(req.params.id);
            res.json({ success: true });
        }
    };
}

module.exports = { createKnowledgeController };
