const { Pool } = require('pg');
const { PostgresAdapter } = require('./postgresAdapter');
const { instrumentDatabase } = require('./monitoredDatabase');

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const createSslConfig = () => {
    if (process.env.DB_SSL !== 'true') return false;
    return {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {})
    };
};

const createConfig = () => ({
    ...(process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_SERVER,
            port: Number(process.env.DB_PORT || 5432),
            database: process.env.DB_NAME
        }),
    ssl: createSslConfig(),
    max: Number(process.env.DB_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
    statement_timeout: Number(process.env.DB_REQUEST_TIMEOUT_MS || 30000),
    application_name: process.env.DB_APPLICATION_NAME || 'ikbenimle-api'
});

async function connectPostgres() {
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        const pool = new Pool(createConfig());
        try {
            await pool.query('SELECT 1');
            console.log('PostgreSQL database connected.');
            return instrumentDatabase(new PostgresAdapter(pool));
        } catch (error) {
            lastError = error;
            await pool.end().catch(() => undefined);
            console.error(`PostgreSQL connection attempt ${attempt}/5 failed: ${error.message}`);
            if (attempt < 5) await wait(5000);
        }
    }
    throw lastError;
}

module.exports = { connectPostgres };
