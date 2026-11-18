const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate } = require('../core/validation');
const { asyncHandler } = require('../core/http');
const schemas = require('../modules/careers/careerSchemas');
const { createCareerRepository } = require('../modules/careers/careerRepository');
const { createCareerService } = require('../modules/careers/careerService');
const { createCareerController } = require('../modules/careers/careerController');

module.exports = (db) => {
    const router = express.Router();
    const manage = requirePermission('manage_careers');
    const controller = createCareerController(createCareerService(createCareerRepository(db)));
    router.use(authenticateToken);
    router.get('/jobs', validate({ query: schemas.employeeJobListQuerySchema }), asyncHandler(controller.listJobs));
    router.get('/jobs/:id', validate({ params: schemas.idParamsSchema }), asyncHandler(controller.getJob));
    router.post('/jobs/:id/apply', validate({ params: schemas.idParamsSchema }), asyncHandler(controller.apply));
    router.get('/my-applications', validate({ query: schemas.myApplicationListQuerySchema }), asyncHandler(controller.listMine));
    router.get('/admin/jobs', manage, validate({ query: schemas.adminJobListQuerySchema }), asyncHandler(controller.listAdminJobs));
    router.post('/admin/jobs', manage, validate({ body: schemas.jobBodySchema }), asyncHandler(controller.createJob));
    router.put('/admin/jobs/:id', manage, validate({ params: schemas.idParamsSchema, body: schemas.jobBodySchema }), asyncHandler(controller.updateJob));
    router.delete('/admin/jobs/:id', manage, validate({ params: schemas.idParamsSchema }), asyncHandler(controller.deleteJob));
    router.get('/admin/jobs/:id/applications', manage, validate({ params: schemas.idParamsSchema, query: schemas.applicationListQuerySchema }), asyncHandler(controller.listApplications));
    router.put('/admin/applications/:id/status', manage, validate({ params: schemas.idParamsSchema, body: schemas.applicationStatusBodySchema }), asyncHandler(controller.updateApplicationStatus));
    return router;
};
