const routerFactory = require('express').Router;
const createCertificateRoutes = require('../modules/employee/certificateRoutes');
const createLearningRoutes = require('../modules/employee/learningRoutes');
const createProfileRoutes = require('../modules/employee/profileRoutes');

module.exports = (db) => {
    const router = routerFactory();
    router.use(createCertificateRoutes(db));
    router.use(createLearningRoutes(db));
    router.use(createProfileRoutes(db));
    return router;
};
