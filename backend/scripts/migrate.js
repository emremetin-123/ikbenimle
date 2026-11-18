require('dotenv').config();

if (process.env.MIGRATION_DB_USER) process.env.DB_USER = process.env.MIGRATION_DB_USER;
if (process.env.MIGRATION_DB_PASSWORD) process.env.DB_PASSWORD = process.env.MIGRATION_DB_PASSWORD;

const { validateEnvironment } = require('../config/environment');
const setupDb = require('../database');
const {
    runMigrations,
    migrationStatus,
    rollbackMigrations
} = require('../migrations');

validateEnvironment();

const migrate = async () => {
    const db = await setupDb();
    try {
        const command = process.argv[2] || 'up';
        if (command === 'up') {
            await runMigrations(db);
            console.log('Database migrations completed.');
        } else if (command === 'status') {
            console.table(await migrationStatus(db));
        } else if (command === 'down') {
            const stepsIndex = process.argv.indexOf('--steps');
            const steps = stepsIndex >= 0 ? Number(process.argv[stepsIndex + 1]) : 1;
            await rollbackMigrations(db, steps);
            console.log(`${steps} migration(s) rolled back.`);
        } else {
            throw new Error(`Unknown migration command: ${command}`);
        }
    } finally {
        await db.close();
    }
};

migrate().catch((error) => {
    console.error('Database migration failed:', error);
    process.exit(1);
});
