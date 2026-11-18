const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomBytes } = require('node:crypto');
const express = require('express');
const sharp = require('sharp');
const { avatarThumbnail } = require('../middleware/avatarThumbnail');
const { privateFileHandler } = require('../middleware/privateFiles');

test('avatar thumbnails reduce transfer size, revalidate behind authentication and retain originals', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'avatar-test-'));
    await fs.mkdir(path.join(root, 'avatars'));
    const filename = path.join(root, 'avatars', 'photo.png');
    await sharp(randomBytes(900 * 900 * 3), { raw: { width: 900, height: 900, channels: 3 } })
        .png().toFile(filename);
    const original = await fs.readFile(filename);
    const app = express();
    app.use('/uploads', (req, res, next) => req.headers['x-test-session'] === 'valid'
        ? next() : res.sendStatus(401), avatarThumbnail(root), privateFileHandler(root));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
    const base = `http://127.0.0.1:${server.address().port}/uploads`;
    const headers = { 'x-test-session': 'valid' };
    const url = `${base}/avatars/photo.png?avatarSize=160`;

    const response = await fetch(url, { headers });
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/webp/);
    assert.equal(response.headers.get('cache-control'), 'private, no-cache');
    assert.ok(buffer.length < original.length / 10);
    const meta = await sharp(buffer).metadata();
    assert.equal(meta.width, 160);
    assert.equal(meta.height, 160);
    const conditionalHeaders = { ...headers, 'If-None-Match': response.headers.get('etag') };
    // Node's default conditional fetch adds no-cache; simulate browser revalidation instead.
    assert.equal((await fetch(url, { headers: conditionalHeaders, cache: 'force-cache' })).status, 304);
    assert.equal((await fetch(url, { headers: { 'If-None-Match': response.headers.get('etag') } })).status, 401);

    const detail = await fetch(`${base}/avatars/photo.png?avatarSize=320`, { headers });
    assert.equal((await sharp(Buffer.from(await detail.arrayBuffer())).metadata()).width, 320);
    await sharp({ create: { width: 400, height: 400, channels: 3, background: 'red' } }).png().toFile(filename);
    const changed = await fetch(url, { headers: conditionalHeaders });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.headers.get('etag'), response.headers.get('etag'));
    assert.equal((await fetch(`${base}/avatars/photo.png?avatarSize=9999`, { headers })).status, 400);
    const unchanged = await fetch(`${base}/avatars/photo.png`, { headers });
    assert.match(unchanged.headers.get('content-type'), /image\/png/);
    assert.equal(unchanged.headers.get('cache-control'), 'private, no-store');
    await fs.unlink(filename);
    assert.equal((await fetch(url, { headers })).status, 404);
});
