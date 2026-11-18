require('dotenv').config();

const pino = require('pino');
const { validateEnvironment } = require('./config/environment');
const setupDb = require('./database');
const { assertNoPendingMigrations } = require('./migrations');
const { startMoodReminderScheduler } = require('./services/pushNotificationService');
const {
    startPolyvalenceScheduleWorker
} = require('./modules/polyvalence/scheduling/scheduleWorker');
const {
    startExpiredTrainingWorker
} = require('./modules/training/expiredTrainingWorker');
const { startAuditRetentionWorker } = require('./modules/audit/auditRetentionWorker');

validateEnvironment();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const start = async () => {
    const db = await setupDb();
    await assertNoPendingMigrations(db);
    const stopNotificationScheduler = startMoodReminderScheduler(db);
    const stopPolyvalenceScheduler = startPolyvalenceScheduleWorker(db);
    const stopExpiredTrainingWorker = startExpiredTrainingWorker(db);
    const stopAuditRetentionWorker = startAuditRetentionWorker(db);
    let stopping = false;

    const shutdown = async (signal) => {
        if (stopping) return;
        stopping = true;
        logger.info({ signal }, 'Worker shutdown started');
        stopNotificationScheduler();
        stopPolyvalenceScheduler();
        stopExpiredTrainingWorker();
        try {
            await stopAuditRetentionWorker();
            await db.close();
            logger.info('Worker shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error({ err: error }, 'Worker database shutdown failed');
            process.exit(1);
        }
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
    logger.info('Background worker started');
};

start().catch((error) => {
    logger.fatal({ err: error }, 'Background worker failed to start');
    process.exit(1);
});
