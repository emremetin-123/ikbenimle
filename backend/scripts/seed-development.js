require('dotenv').config();

const { validateEnvironment } = require('../config/environment');
const setupDb = require('../database');
const { assertNoPendingMigrations } = require('../migrations');
const { runDevelopmentSeeds } = require('../db/seeds/runDevelopmentSeeds');

validateEnvironment();

const seed = async () => {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('DEVELOPMENT_SEED_FORBIDDEN_IN_PRODUCTION');
    }
    const db = await setupDb();
    try {
        await assertNoPendingMigrations(db);
        await runDevelopmentSeeds(db, { includeSampleEmployee: true });
        console.log('Development seed completed.');
    } finally {
        await db.close();
    }
};

seed().catch((error) => {
    console.error('Development seed failed:', error.message);
    process.exit(1);
});
