const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { validateEnvironment } = require('../config/environment');
const { runDevelopmentSeeds } = require('../db/seeds/runDevelopmentSeeds');

test('production eksik veya guvensiz ortam ayarlariyla baslamaz', () => {
    assert.throws(
        () => validateEnvironment({
            NODE_ENV: 'production',
            DB_TYPE: 'sqlite',
            DB_ENCRYPT: 'false'
        }),
        /INVALID_ENVIRONMENT/
    );
});

test('production PostgreSQL ayarlariyla dogrulanir', () => {
    const env = validateEnvironment({
        NODE_ENV: 'production',
        DB_TYPE: 'postgres',
        DB_USER: 'app',
        DB_PASSWORD: 'secret',
        DB_SERVER: 'sql.example.com',
        DB_NAME: 'portal',
        DB_SSL: 'true',
        CORS_ORIGINS: 'https://ikbenimle.com',
        PUBLIC_APP_URL: 'https://ikbenimle.com',
        SESSION_IDLE_MINUTES: '30',
        SESSION_ABSOLUTE_HOURS: '8'
    });
    assert.equal(env.DB_TYPE, 'postgres');
    assert.equal(env.PORT, 5000);
    assert.equal(env.SESSION_WARNING_SECONDS, 30);
});

test('session uyarisi idle suresinden kisa olmalidir', () => {
    assert.throws(
        () => validateEnvironment({
            SESSION_IDLE_MINUTES: '5',
            SESSION_WARNING_SECONDS: '300'
        }),
        /Session warning must be shorter/
    );
});

test('production proxy zincirinde istemci IP adresi dogru secilir', () => {
    const app = express();
    const request = Object.assign(Object.create(app.request), {
        socket: { remoteAddress: '172.18.0.3' },
        headers: { 'x-forwarded-for': '203.0.113.9, 2001:db8::42, 172.18.0.2' }
    });
    app.set('trust proxy', validateEnvironment({ TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS);
    assert.equal(request.ip, '2001:db8::42');
    app.set('trust proxy', validateEnvironment({}).TRUST_PROXY_HOPS);
    request.headers['x-forwarded-for'] = '203.0.113.9, 198.51.100.42';
    assert.equal(request.ip, '198.51.100.42');
    assert.throws(() => validateEnvironment({ TRUST_PROXY_HOPS: 'true' }), /TRUST_PROXY_HOPS/);
});

test('production SQLite yalnizca acik gecis izniyle dogrulanir', () => {
    const env = validateEnvironment({
        NODE_ENV: 'production',
        DB_TYPE: 'sqlite',
        ALLOW_PRODUCTION_SQLITE: 'true',
        CORS_ORIGINS: 'https://ikbenimle.com',
        PUBLIC_APP_URL: 'https://ikbenimle.com'
    });
    assert.equal(env.DB_TYPE, 'sqlite');
    assert.equal(env.ALLOW_PRODUCTION_SQLITE, 'true');
});

test('development seed production ortaminda calismaz', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        await assert.rejects(
            runDevelopmentSeeds({}),
            /DEVELOPMENT_SEED_FORBIDDEN_IN_PRODUCTION/
        );
    } finally {
        process.env.NODE_ENV = previousNodeEnv;
    }
});
