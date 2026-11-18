const createEmployeeSurveyRoutes = require('../modules/surveys/employeeSurveyRoutes');
const createAdminSurveyRoutes = require('../modules/surveys/adminSurveyRoutes');

module.exports = (db, mode = 'user') => (
    mode === 'admin'
        ? createAdminSurveyRoutes(db)
        : createEmployeeSurveyRoutes(db)
);
