const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const {
    idParamsSchema,
    listQuerySchema,
    routeBodySchema
} = require('../modules/serviceRoutes/serviceRouteSchemas');
const {
    createServiceRouteRepository
} = require('../modules/serviceRoutes/serviceRouteRepository');
const { createServiceRouteService } = require('../modules/serviceRoutes/serviceRouteService');
const {
    createServiceRouteController
} = require('../modules/serviceRoutes/serviceRouteController');

module.exports = (db, mode = 'user') => {
    const router = express.Router();
    const isAdminMode = mode === 'admin';
    const controller = createServiceRouteController(
        createServiceRouteService(createServiceRouteRepository(db)),
        isAdminMode
    );
    router.use(authenticateToken);
    if (isAdminMode) router.use(requirePermission('manage_service_routes'));
    router.get('/', validate({ query: listQuerySchema }), asyncHandler(controller.list));
    if (!isAdminMode) return router;
    router.post('/', validate({ body: routeBodySchema }), asyncHandler(controller.create));
    router.put(
        '/:id',
        validate({ params: idParamsSchema, body: routeBodySchema }),
        asyncHandler(controller.update)
    );
    router.delete(
        '/:id',
        validate({ params: idParamsSchema }),
        asyncHandler(controller.remove)
    );
    return router;
};
