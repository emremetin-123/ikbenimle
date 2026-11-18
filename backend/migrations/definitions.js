const base = require('./definitions/base');
const auth = require('./definitions/auth');
const platform = require('./definitions/platform');
const careers = require('./definitions/careers');
const operations = require('./definitions/operations');
const notifications = require('./definitions/notifications');
const meals = require('./definitions/meals');
const privacy = require('./definitions/privacy');
const reminders = require('./definitions/reminders');
const integrations = require('./definitions/integrations');
const polyvalence = require('./definitions/polyvalence');
const training = require('./definitions/training');
const storage = require('./definitions/storage');
const trainingModules = require('./definitions/trainingModules');
const profile = require('./definitions/profile');
const feedback = require('./definitions/feedback');
const trainingBadges = require('./definitions/trainingBadges');
const auditLogs = require('./definitions/auditLogs');
const payrollIntegrations = require('./definitions/payrollIntegrations');

const MIGRATIONS = [
    ...base,
    ...auth,
    ...platform,
    ...careers,
    ...operations,
    ...notifications,
    ...meals,
    ...privacy,
    ...reminders,
    ...integrations,
    ...polyvalence,
    ...training,
    ...storage,
    ...trainingModules,
    ...profile,
    ...feedback,
    ...trainingBadges,
    ...auditLogs,
    ...payrollIntegrations
].sort((left, right) => left.version.localeCompare(right.version));

module.exports = { MIGRATIONS };
