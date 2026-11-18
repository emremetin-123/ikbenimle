import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:5000';
const password = __ENV.TEST_PASSWORD;
const userPrefix = __ENV.TEST_USER_PREFIX || 'load';
const userCount = Number(__ENV.TEST_USER_COUNT || 500);
const thinkTimeSeconds = Number(__ENV.THINK_TIME_SECONDS || 8);

export const options = {
    // The daily mood receipt is a device cookie and must survive iterations.
    noCookiesReset: true,
    scenarios: {
        routine_usage: {
            executor: 'constant-vus',
            vus: Number(__ENV.ROUTINE_VUS || 100),
            duration: __ENV.ROUTINE_DURATION || '2m'
        },
        login_burst: {
            executor: 'ramping-arrival-rate',
            startRate: 1,
            timeUnit: '1s',
            preAllocatedVUs: 20,
            maxVUs: 150,
            stages: [
                { target: Number(__ENV.LOGIN_RATE || 10), duration: '30s' },
                { target: 0, duration: '15s' }
            ]
        }
    },
    thresholds: {
        checks: ['rate>0.99'],
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<800'],
        'http_req_duration{endpoint:read}': ['p(95)<500'],
        'http_req_duration{endpoint:write}': ['p(95)<800']
    }
};

const employeeIdForVu = () => (
    `${userPrefix}${String(((__VU - 1) % userCount) + 1).padStart(4, '0')}`
);

const login = () => {
    if (!password || userCount < 1) {
        throw new Error('TEST_PASSWORD and a positive TEST_USER_COUNT are required');
    }
    const response = http.post(
        `${baseUrl}/api/login`,
        JSON.stringify({ employee_id: employeeIdForVu(), password }),
        { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } }
    );
    check(response, { 'login succeeds': value => value.status === 200 });
    return response.status === 200;
};

export default function () {
    if (!login()) return;

    const responses = http.batch([
        ['GET', `${baseUrl}/api/session`, null, { tags: { endpoint: 'read' } }],
        ['GET', `${baseUrl}/api/announcements`, null, { tags: { endpoint: 'read' } }],
        ['GET', `${baseUrl}/api/news`, null, { tags: { endpoint: 'read' } }],
        ['GET', `${baseUrl}/api/meal-menu/today`, null, { tags: { endpoint: 'read' } }],
        ['GET', `${baseUrl}/api/videos`, null, { tags: { endpoint: 'read' } }]
    ]);
    check(responses, {
        'routine reads succeed': values => values.every(response => response.status === 200)
    });

    if (__ITER % 5 === 0) {
        const moodStatus = http.get(`${baseUrl}/api/mood-check/today`, {
            tags: { endpoint: 'read' }
        });
        const validStatus = check(moodStatus, {
            'daily mood status succeeds': value => (
                value.status === 200 && typeof value.json('submitted') === 'boolean'
            )
        });
        if (!validStatus || moodStatus.json('submitted')) {
            sleep(thinkTimeSeconds);
            return;
        }
        const csrfCookie = http.cookieJar().cookiesForURL(`${baseUrl}/api/mood-check`)
            .ikbenimle_csrf?.[0];
        const writeResponse = http.post(
            `${baseUrl}/api/mood-check`,
            JSON.stringify({
                mood_id: 'good',
                reason_key: null
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfCookie || ''
                },
                tags: { endpoint: 'write' }
            }
        );
        check(writeResponse, { 'routine write succeeds': value => value.status === 200 });
    }
    sleep(thinkTimeSeconds);
}
