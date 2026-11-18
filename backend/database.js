const { connectSqlite } = require('./db/connectSqlite');
const { connectPostgres } = require('./db/connectPostgres');

const setupDb = () => (
    process.env.DB_TYPE === 'sqlite'
        ? connectSqlite()
        : connectPostgres()
);

module.exports = setupDb;
