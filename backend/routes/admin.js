const express = require('express');
const createAdminUserRoutes = require('../modules/users/adminUserRoutes');
const createAdminAiSettingsRoutes = require('../modules/settings/adminAiSettingsRoutes');
const createAdminTrainingCatalogRoutes = require('../modules/training/adminTrainingCatalogRoutes');
const createAdminTrainingMutationRoutes = require('../modules/training/adminTrainingMutationRoutes');
const createAdminTrainingAssignmentRoutes = require('../modules/training/adminTrainingAssignmentRoutes');
const createAdminIntegrationRoutes = require('../modules/integrations/adminIntegrationRoutes');
const createAuditRoutes = require('../modules/audit/auditRoutes');

module.exports = function createAdminRouter(db) {
    const router = express.Router();
    router.use(createAdminAiSettingsRoutes(db));
    router.use(createAdminUserRoutes(db));
    router.use(createAdminTrainingCatalogRoutes(db));
    router.use(createAdminTrainingMutationRoutes(db));
    router.use(createAdminTrainingAssignmentRoutes(db));
    router.use(createAdminIntegrationRoutes(db));
    router.use(createAuditRoutes(db));
    return router;
};
