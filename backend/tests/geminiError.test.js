const test = require('node:test');
const assert = require('node:assert/strict');
const { geminiError } = require('../services/geminiError');

test('Gemini errors distinguish credentials, permissions, quota and request failures without exposing provider payloads', () => {
    assert.match(geminiError(400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}'), /anahtarı geçersiz/);
    assert.match(geminiError(403, 'key was reported as leaked'), /engellenmiş/);
    assert.match(geminiError(403), /erişimi reddedildi/);
    assert.match(geminiError(429), /kota/);
    assert.match(geminiError(404), /modeli veya API/);
    assert.match(geminiError(400, 'invalid document'), /PDF veya analiz/);
    for (const status of [400, 401, 403, 404, 429, 500]) {
        assert.doesNotMatch(geminiError(status, 'SECRET_KEY_AND_PRIVATE_DOCUMENT'), /SECRET_KEY_AND_PRIVATE_DOCUMENT/);
        assert.match(geminiError(status), new RegExp(`HTTP ${status}`));
    }
});
