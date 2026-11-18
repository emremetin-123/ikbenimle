const bcrypt = require('bcryptjs');
const setupDb = require('../database');
const { runMigrations } = require('../migrations');

const requireStagingConfirmation = () => {
    if (process.env.NODE_ENV === 'production' || process.env.LOAD_TEST_CONFIRM !== 'staging') {
        throw new Error(
            'Load-test data can only be generated outside production with LOAD_TEST_CONFIRM=staging.'
        );
    }
};

async function main() {
    requireStagingConfirmation();
    const count = Number(process.env.LOAD_TEST_USER_COUNT || 500);
    const prefix = String(process.env.LOAD_TEST_USER_PREFIX || 'load');
    const password = String(process.env.LOAD_TEST_PASSWORD || '');
    if (!Number.isInteger(count) || count < 1 || count > 5000) {
        throw new Error('LOAD_TEST_USER_COUNT must be between 1 and 5000.');
    }
    if (password.length < 12) {
        throw new Error('LOAD_TEST_PASSWORD must contain at least 12 characters.');
    }

    const db = await setupDb();
    try {
        await runMigrations(db);
        const passwordHash = await bcrypt.hash(password, 10);
        await db.transaction(async tx => {
            for (let index = 1; index <= count; index += 1) {
                const employeeId = `${prefix}${String(index).padStart(4, '0')}`;
                const existing = await tx.get(
                    'SELECT id FROM users WHERE employee_id = ?',
                    [employeeId]
                );
                const values = [
                    `Yuk Testi Kullanicisi ${index}`,
                    index % 2 ? 'Pres' : 'Taslama',
                    index % 5 ? 'Operator' : 'Takim Lideri',
                    passwordHash,
                    'employee',
                    '[]'
                ];
                if (existing) {
                    await tx.run(
                        `UPDATE users
                         SET name = ?, department = ?, position = ?, password_hash = ?,
                             role = ?, permissions = ?, status = 'active'
                         WHERE id = ?`,
                        [...values, existing.id]
                    );
                } else {
                    await tx.run(
                        `INSERT INTO users (
                            employee_id, name, department, position, password_hash,
                            role, permissions, status
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                        [employeeId, ...values]
                    );
                }
            }

            const users = await tx.all(
                'SELECT id, employee_id FROM users WHERE employee_id LIKE ? ORDER BY employee_id',
                [`${prefix}%`]
            );
            const ownerId = users[0]?.id;
            const visibleUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);

            for (let index = 1; index <= 40; index += 1) {
                const title = `[LOAD] Duyuru ${index}`;
                if (!await tx.get('SELECT id FROM announcements WHERE title = ?', [title])) {
                    await tx.run(
                        `INSERT INTO announcements
                            (title, content, visible_until, created_by)
                         VALUES (?, ?, ?, ?)`,
                        [title, 'Staging performans testi duyurusu.', visibleUntil, ownerId]
                    );
                }
            }

            const videos = [];
            for (let index = 1; index <= 8; index += 1) {
                const title = `[LOAD] Egitim ${index}`;
                let video = await tx.get('SELECT id FROM videos WHERE title = ?', [title]);
                if (!video) {
                    await tx.run(
                        `INSERT INTO videos
                            (title, category, is_latest, is_active, requires_quiz)
                         VALUES (?, ?, 1, 1, 0)`,
                        [title, 'Performans Testi']
                    );
                    video = await tx.get('SELECT id FROM videos WHERE title = ?', [title]);
                }
                videos.push(video.id);
            }

            for (let index = 0; index < users.length; index += 1) {
                const user = users[index];
                for (let offset = 0; offset < 4; offset += 1) {
                    const videoId = videos[(index + offset) % videos.length];
                    const assignment = await tx.get(
                        'SELECT id FROM assignments WHERE user_id = ? AND video_id = ?',
                        [user.id, videoId]
                    );
                    if (!assignment) {
                        await tx.run(
                            'INSERT INTO assignments (user_id, video_id, training_root_id, status) VALUES (?, ?, ?, ?)',
                            [user.id, videoId, videoId, offset === 0 ? 'completed' : 'assigned']
                        );
                    }
                }

                const feedbackTitle = `[LOAD] Geri bildirim ${user.employee_id}`;
                if (!await tx.get(
                    'SELECT id FROM feedback WHERE user_id = ? AND title = ?',
                    [user.id, feedbackTitle]
                )) {
                    await tx.run(
                        `INSERT INTO feedback (user_id, type, title, content, status)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            user.id,
                            index % 2 ? 'suggestion' : 'complaint',
                            feedbackTitle,
                            'Staging performans testi geri bildirimi.',
                            index % 3 ? 'pending' : 'completed'
                        ]
                    );
                }
            }
        });
        console.log(
            `Prepared ${count} users with announcements, trainings, assignments and feedback.`
        );
    } finally {
        await db.close();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
