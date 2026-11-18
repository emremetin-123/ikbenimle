const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const textExtensions = new Set([
    '.css',
    '.example',
    '.html',
    '.js',
    '.json',
    '.md',
    '.mjs',
    '.ps1',
    '.sh',
    '.sql',
    '.ts',
    '.tsx',
    '.txt',
    '.yaml',
    '.yml'
]);
const suspiciousCodePoints = new Set([
    0x00c2,
    0x00c3,
    0x00c4,
    0x00c5,
    0x0178,
    0xfffd
]);

test('Git tarafindan izlenen metin dosyalari mojibake karakteri icermez', () => {
    const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
        cwd: repoRoot,
        encoding: 'utf8'
    }).split('\0').filter(Boolean);
    const findings = [];

    for (const relativePath of trackedFiles) {
        if (!textExtensions.has(path.extname(relativePath).toLowerCase())) continue;

        const absolutePath = path.join(repoRoot, relativePath);
        if (!fs.existsSync(absolutePath)) continue;

        const content = fs.readFileSync(absolutePath, 'utf8');
        content.split(/\r?\n/).forEach((line, index) => {
            if ([...line].some((character) => suspiciousCodePoints.has(character.codePointAt(0)))) {
                findings.push(`${relativePath}:${index + 1}`);
            }
        });
    }

    assert.deepEqual(
        findings,
        [],
        `Bozuk UTF-8/mojibake karakterleri bulundu:\n${findings.join('\n')}`
    );
});
