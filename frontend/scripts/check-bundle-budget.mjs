import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const distDir = path.resolve('dist');
const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
const initialAssets = [...html.matchAll(/(?:src|href)="\/?([^"]+\.(?:js|css))"/g)]
  .map(match => match[1])
  .filter((value, index, values) => values.indexOf(value) === index);

const gzipSize = async (relativePath) => gzipSync(
  await readFile(path.join(distDir, relativePath))
).byteLength;

const initial = await Promise.all(initialAssets.map(async asset => ({
  asset,
  gzip: await gzipSize(asset)
})));
const initialTotal = initial.reduce((sum, item) => sum + item.gzip, 0);
const initialLimit = 220 * 1024;

const assetFiles = (await readdir(path.join(distDir, 'assets')))
  .filter(file => file.endsWith('.js'));
const lazyLimit = 150 * 1024;
const oversized = [];
for (const file of assetFiles) {
  const gzip = await gzipSize(path.join('assets', file));
  if (gzip > lazyLimit) oversized.push({ file, gzip });
}

const formatKb = bytes => `${(bytes / 1024).toFixed(1)} KB`;
console.log(`Initial gzip: ${formatKb(initialTotal)} / ${formatKb(initialLimit)}`);
for (const item of initial) console.log(`  ${item.asset}: ${formatKb(item.gzip)}`);

if (initialTotal > initialLimit || oversized.length) {
  for (const item of oversized) {
    console.error(`Lazy chunk exceeds ${formatKb(lazyLimit)}: ${item.file} (${formatKb(item.gzip)})`);
  }
  process.exit(1);
}
