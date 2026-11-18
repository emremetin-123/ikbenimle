const { AppError } = require('../../core/http');

const normalizeReminder = row => ({
    id: Number(row.id),
    text: row.reminder_text,
    completed: Boolean(row.is_completed),
    pinned: Boolean(row.is_pinned),
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at || null
});

function createReminderService(repository) {
    const requireOwned = async (id, userId) => {
        const reminder = await repository.findOwned(id, userId);
        if (!reminder) {
            throw new AppError(404, 'REMINDER_NOT_FOUND', 'Hatırlatma bulunamadı.');
        }
        return reminder;
    };

    return {
        async list(userId) {
            return (await repository.list(userId)).map(normalizeReminder);
        },
        async create(userId, text) {
            return normalizeReminder(await repository.create(userId, text));
        },
        async update(id, userId, body) {
            await requireOwned(id, userId);
            return normalizeReminder(await repository.update(id, userId, body));
        },
        async remove(id, userId) {
            await requireOwned(id, userId);
            await repository.remove(id, userId);
        }
    };
}

module.exports = { createReminderService };
