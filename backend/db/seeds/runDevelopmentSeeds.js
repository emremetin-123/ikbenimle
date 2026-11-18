const bcrypt = require('bcryptjs');
const {
    seedHRInfo,
    clearDemoProfilePhotoLinks
} = require('./seedData');

async function ensureSeedUser(db, employeeId, name, role, passwordVariable) {
    const existing = await db.get(
        'SELECT id FROM users WHERE employee_id = ?',
        [employeeId]
    );
    if (existing) return;

    const password = process.env[passwordVariable];
    if (!password) {
        throw new Error(`${passwordVariable} is required when SEED_DEFAULT_USERS=true`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.run(
        'INSERT INTO users (employee_id, name, password_hash, role) VALUES (?, ?, ?, ?)',
        [employeeId, name, passwordHash, role]
    );
}

async function runDevelopmentSeeds(db, { includeSampleEmployee = false } = {}) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('DEVELOPMENT_SEED_FORBIDDEN_IN_PRODUCTION');
    }
    if (process.env.SEED_DEFAULT_USERS === 'true') {
        await ensureSeedUser(
            db,
            'admin',
            'System Admin',
            'admin',
            'DEFAULT_ADMIN_PASSWORD'
        );
        if (includeSampleEmployee) {
            await ensureSeedUser(
                db,
                '1001',
                'Test Employee',
                'employee',
                'DEFAULT_EMPLOYEE_PASSWORD'
            );
        }
    }

    if (process.env.SEED_SAMPLE_DATA === 'true') await seedHRInfo(db);
    await clearDemoProfilePhotoLinks(db);
}

module.exports = { runDevelopmentSeeds };
