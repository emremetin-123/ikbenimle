import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const collectFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(target) : [target];
  });

const files = collectFiles(root)
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => path.relative(root, file))
  .sort();

let failed = false;
for (const file of files) {
  const lineCount = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).length;
  console.log(`${file}: ${lineCount}/500`);
  if (lineCount > 500) failed = true;
}

if (failed) {
  console.error('Frontend source budget exceeded.');
  process.exit(1);
}
