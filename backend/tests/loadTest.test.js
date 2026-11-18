const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const { moodBodySchema } = require('../modules/mood/moodSchemas');
const { connectSqlite } = require('../db/connectSqlite');
const { connectPostgres } = require('../db/connectPostgres');

function loadProfile() {
    const calls = [];
    const failures = [];
    let submitted = false;
    let status = 200;
    const response = () => ({ status, json: key => key === 'submitted' ? submitted : undefined });
    const context = vm.createContext({
        __ENV: { TEST_PASSWORD: 'local-test-password' },
        __VU: 1,
        __ITER: 0,
        sleep() {},
        check(value, checks) {
            const results = Object.entries(checks).map(([name, predicate]) => {
                const passed = predicate(value);
                if (!passed) failures.push(name);
                return passed;
            });
            return results.every(Boolean);
        },
        http: {
            batch: requests => requests.map(() => ({ status: 200 })),
            get(url) {
                calls.push({ method: 'GET', url });
                return response();
            },
            post(url, body, params) {
                calls.push({ method: 'POST', url, body, params });
                if (url.endsWith('/api/mood-check')) {
                    moodBodySchema.parse(JSON.parse(body));
                    assert.equal(params.headers['X-CSRF-Token'], 'test-csrf');
                    assert.equal(submitted, false, 'daily receipt prevents duplicate writes');
                    submitted = true;
                }
                return { status: 200 };
            },
            cookieJar: () => ({ cookiesForURL: () => ({ ikbenimle_csrf: ['test-csrf'] }) })
        }
    });
    const source = fs.readFileSync(path.join(__dirname, '../../performance/k6-smoke.js'), 'utf8')
        .replace(/^import .*;\r?\n/gm, '')
        .replace('export const options =', 'globalThis.options =')
        .replace('export default function ()', 'globalThis.runIteration = function ()');
    vm.runInContext(source, context);
    return {
        context, calls, failures,
        setSubmitted: value => { submitted = value; },
        setStatus: value => { status = value; }
    };
}

test('k6 mood payload matches the API and respects the daily receipt across iterations', () => {
    const profile = loadProfile();
    assert.equal(profile.context.options.noCookiesReset, true);
    assert.ok(profile.context.options.thresholds.checks);
    for (const iteration of [0, 1, 5, 10]) {
        profile.context.__ITER = iteration;
        profile.context.runIteration();
    }
    const writes = () => profile.calls.filter(call => call.url.endsWith('/api/mood-check'));
    assert.equal(writes().length, 1);
    assert.deepEqual(JSON.parse(writes()[0].body), { mood_id: 'good', reason_key: null });
    assert.equal(profile.calls.filter(call => call.method === 'GET').length, 3);
    // A new day permits a new response, as reported by the API.
    profile.setSubmitted(false);
    profile.context.__ITER = 15;
    profile.context.runIteration();
    assert.equal(writes().length, 2);
    assert.deepEqual(profile.failures, []);
});

test('k6 skips an existing daily response and reports failed status reads', () => {
    const profile = loadProfile();
    profile.setSubmitted(true);
    profile.context.runIteration();
    assert.deepEqual(profile.failures, []);
    profile.setStatus(500);
    profile.context.runIteration();
    assert.deepEqual(profile.failures, ['daily mood status succeeds']);
    assert.equal(profile.calls.some(call => call.url.endsWith('/api/mood-check')), false);
});

for (const dialect of ['sqlite', 'postgres']) {
    test(`load-test seed is repeatable on ${dialect} with current migrations`, {
        skip: dialect === 'postgres' && !process.env.POSTGRES_TEST_URL
    }, async t => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-test-'));
        const previous = { ...process.env };
        Object.assign(process.env, {
            DB_TYPE: dialect,
            SQLITE_FILENAME: path.join(tempDir, 'test.sqlite'),
            DATABASE_URL: process.env.POSTGRES_TEST_URL || '',
            DB_SSL: 'false'
        });
        let db;
        t.after(async () => {
            if (db) {
                if (dialect === 'postgres') await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
                await db.close();
            }
            for (const key of ['DB_TYPE', 'SQLITE_FILENAME', 'DATABASE_URL', 'DB_SSL']) {
                if (previous[key] === undefined) delete process.env[key];
                else process.env[key] = previous[key];
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
        });
        const env = {
            ...process.env, NODE_ENV: 'test', LOAD_TEST_CONFIRM: 'staging',
            LOAD_TEST_USER_COUNT: '3', LOAD_TEST_USER_PREFIX: 'load',
            LOAD_TEST_PASSWORD: 'local-test-password'
        };
        if (dialect === 'postgres') {
            db = await connectPostgres();
            await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        }
        for (let run = 0; run < 2; run += 1) {
            await execFile(process.execPath, ['scripts/seed-load-test.js'], {
                cwd: path.join(__dirname, '..'), env
            });
        }
        if (!db) db = await connectSqlite();
        for (const [table, count] of Object.entries({
            users: 3, announcements: 40, videos: 8, assignments: 12, feedback: 3
        })) {
            assert.equal(Number((await db.get(`SELECT COUNT(*) AS total FROM ${table}`)).total), count);
        }
    });
}
