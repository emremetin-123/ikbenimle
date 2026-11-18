const { Router } = require('express');
const { validate } = require('../../../core/validation');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const schemas = require('./catalogSchemas');
const { route } = require('./catalogRouteSupport');
const { createCatalogRepository } = require('./catalogRepository');
const { createCatalogService } = require('./catalogService');

const MANAGE_PERMISSION = 'manage_polyvalence';
const {
    idParamsSchema, archiveBodySchema, departmentBodySchema, roleBodySchema,
    categoryBodySchema, skillBodySchema, trainingLinksSchema
} = schemas;

const createCatalogRouter = ({ db, addAudit }) => {
    const router = Router();
    const secured = [authenticateToken, requirePermission(MANAGE_PERMISSION)];
    const service = createCatalogService({
        db,
        repository: createCatalogRepository(db),
        addAudit
    });

    router.post('/admin/departments', ...secured, validate({ body: departmentBodySchema }),
        route(async (req, res) => res.json(await service.create('department', req))));
    router.put('/admin/departments/:id', ...secured,
        validate({ params: idParamsSchema, body: departmentBodySchema }),
        route(async (req, res) => res.json(await service.update('department', req))));
    router.post('/admin/departments/:id/archive', ...secured,
        validate({ params: idParamsSchema, body: archiveBodySchema }),
        route(async (req, res) => res.json(await service.setArchived('department', req))));

    router.post('/admin/roles', ...secured, validate({ body: roleBodySchema }),
        route(async (req, res) => res.json(await service.create('role', req))));
    router.put('/admin/roles/:id', ...secured,
        validate({ params: idParamsSchema, body: roleBodySchema.pick({ name: true }) }),
        route(async (req, res) => res.json(await service.update('role', req))));
    router.post('/admin/roles/:id/archive', ...secured,
        validate({ params: idParamsSchema, body: archiveBodySchema }),
        route(async (req, res) => res.json(await service.setArchived('role', req))));

    router.post('/admin/categories', ...secured, validate({ body: categoryBodySchema }),
        route(async (req, res) => res.json(await service.create('category', req))));
    router.put('/admin/categories/:id', ...secured,
        validate({ params: idParamsSchema, body: categoryBodySchema.pick({ name: true }) }),
        route(async (req, res) => res.json(await service.update('category', req))));
    router.post('/admin/categories/:id/archive', ...secured,
        validate({ params: idParamsSchema, body: archiveBodySchema }),
        route(async (req, res) => res.json(await service.setArchived('category', req))));

    router.post('/admin/skills', ...secured, validate({ body: skillBodySchema }),
        route(async (req, res) => res.json(await service.create('skill', req))));
    router.put('/admin/skills/:id', ...secured,
        validate({ params: idParamsSchema, body: skillBodySchema.omit({ department_id: true }) }),
        route(async (req, res) => res.json(await service.update('skill', req))));
    router.post('/admin/skills/:id/archive', ...secured,
        validate({ params: idParamsSchema, body: archiveBodySchema }),
        route(async (req, res) => res.json(await service.setArchived('skill', req))));
    router.put('/admin/skills/:id/trainings', ...secured,
        validate({ params: idParamsSchema, body: trainingLinksSchema }),
        route(async (req, res) => res.json(await service.replaceSkillTrainings(req))));

    return router;
};

module.exports = { createCatalogRouter };
