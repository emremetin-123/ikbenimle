const crypto = require('node:crypto');
const { createTrainingRepository } = require('./trainingRepository');
const {
    addValidity,
    createExpiredTrainingService
} = require('./expiredTrainingService');

const createWorkerContext = db => {
    const repository = createTrainingRepository(db);
    return {
        repository,
        service: createExpiredTrainingService(repository)
    };
};

const runExpiredReassignments = (db, userId = null) => (
    createWorkerContext(db).service.run(userId)
);

const startExpiredTrainingWorker = db => {
    const ownerId = crypto.randomUUID();
    const { repository, service } = createWorkerContext(db);
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const lockDate = new Date(Date.now() + 10 * 60 * 1000);
            const lockUntil = process.env.DB_TYPE === 'postgres'
                ? lockDate
                : lockDate.toISOString().replace('T', ' ').replace('Z', '');
            if (await repository.acquireLease(ownerId, lockUntil)) {
                await service.run();
            }
        } catch (error) {
            console.error('Expired training worker error:', error.message);
        } finally {
            running = false;
        }
    };
    void tick();
    const timer = setInterval(tick, 15 * 60 * 1000);
    return () => clearInterval(timer);
};

module.exports = {
    addValidity,
    runExpiredReassignments,
    startExpiredTrainingWorker
};
