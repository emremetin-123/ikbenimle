const routerFactory = require('express').Router;
const createProfileRoutes = require('../modules/personalInfo/profileRoutes');
const createDocumentRoutes = require('../modules/personalInfo/documentRoutes');

module.exports = (db) => {
    const router = routerFactory();
    router.use(createProfileRoutes(db));
    router.use(createDocumentRoutes(db));
    return router;
};
