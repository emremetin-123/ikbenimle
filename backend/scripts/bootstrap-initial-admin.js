require('dotenv').config();

const bcrypt = require('bcryptjs');
const setupDb = require('../database');
const { validateEnvironment } = require('../config/environment');
const { assertNoPendingMigrations } = require('../migrations');

const required = (name) => {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`${name}_REQUIRED`);
    return value;
};

async function bootstrapInitialAdmin() {
    validateEnvironment();
    if (process.env.ALLOW_INITIAL_ADMIN_BOOTSTRAP !== 'true') {
        throw new Error('INITIAL_ADMIN_BOOTSTRAP_NOT_ALLOWED');
    }

    const employeeId = required('INITIAL_ADMIN_EMPLOYEE_ID');
    const name = required('INITIAL_ADMIN_NAME');
    const password = required('INITIAL_ADMIN_PASSWORD');
    if (password.length < 12) throw new Error('INITIAL_ADMIN_PASSWORD_TOO_SHORT');

    const db = await setupDb();
    try {
        await assertNoPendingMigrations(db);
        await db.transaction(async (tx) => {
            const row = await tx.get('SELECT COUNT(*) AS count FROM users');
            if (Number(row?.count || 0) !== 0) {
                throw new Error('INITIAL_ADMIN_REQUIRES_EMPTY_USERS_TABLE');
            }
            const passwordHash = await bcrypt.hash(password, 12);
            await tx.run(
                `INSERT INTO users
                    (employee_id, name, password_hash, role, status, permissions)
                 VALUES (?, ?, ?, 'admin', 'active', ?)`,
                [employeeId, name, passwordHash, JSON.stringify([])]
            );
        });
        console.log(`Initial admin created for employee ID: ${employeeId}`);
    } finally {
        await db.close();
    }
}

bootstrapInitialAdmin().catch((error) => {
    console.error('Initial admin bootstrap failed:', error.message);
    process.exit(1);
});
