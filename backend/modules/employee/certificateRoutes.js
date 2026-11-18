const routerFactory = require('express').Router;
const { authenticateToken } = require('../../middleware/auth');
const { publicVerifyLimiter } = require('../../middleware/rateLimits');
const { createEmployeeLearningRepository } = require('./employeeLearningRepository');
const { createEmployeeCertificateService } = require('./employeeCertificateService');
const { createEmployeeCertificateController } = require('./employeeCertificateController');

module.exports = db => {
    const router = routerFactory();
    const controller = createEmployeeCertificateController(
        createEmployeeCertificateService(db, createEmployeeLearningRepository(db))
    );

    router.get('/certificates/:reference/verify', publicVerifyLimiter, controller.verify);
    router.get(
        '/assignment/:id/certificate.pdf',
        authenticateToken,
        controller.download
    );

    return router;
};
