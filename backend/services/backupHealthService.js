const fs = require('node:fs/promises');

const MAX_BACKUP_AGE_SECONDS = 36 * 60 * 60;

const readBackupHealth = async (
    statusPath = process.env.BACKUP_STATUS_FILE || '/var/run/ikbenimle-backup/status.json',
    nowSeconds = Math.floor(Date.now() / 1000)
) => {
    try {
        const raw = await fs.readFile(statusPath, 'utf8');
        const status = JSON.parse(raw);
        const ageSeconds = Number.isFinite(Number(status.finished_epoch))
            ? Math.max(0, nowSeconds - Number(status.finished_epoch))
            : null;
        const healthy = status.status === 'success'
            && ageSeconds !== null
            && ageSeconds <= MAX_BACKUP_AGE_SECONDS;
        return {
            healthy,
            age_seconds: ageSeconds,
            max_age_seconds: MAX_BACKUP_AGE_SECONDS,
            ...status
        };
    } catch {
        return {
            healthy: false,
            status: 'missing',
            message: 'No successful backup status is available.',
            age_seconds: null,
            max_age_seconds: MAX_BACKUP_AGE_SECONDS
        };
    }
};

module.exports = { readBackupHealth, MAX_BACKUP_AGE_SECONDS };
