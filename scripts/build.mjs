import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

// The source is already static. Verify it without removing or regenerating dist.
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
for (const name of ['index.html', 'styles.css', 'app.js', 'data/manifest.json', 'data/LICENSE-model.txt']) {
  await access(join(dist, name));
}
const syntax = spawnSync(process.execPath, ['--check', join(dist, 'app.js')], { stdio: 'inherit' });
if (syntax.error) throw syntax.error;
if (syntax.status !== 0) throw new Error('Browser JavaScript failed its syntax check.');

const data = join(dist, 'data');
const manifest = JSON.parse(await readFile(join(data, 'manifest.json'), 'utf8'));
for (const asset of manifest.assets) {
  const path = resolve(data, asset.file);
  if (relative(data, path).startsWith('..')) throw new Error('Invalid data asset path.');
  const bytes = await readFile(path);
  if (bytes.length !== asset.bytes) throw new Error(`Incorrect file size: ${asset.file}`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== asset.sha256) throw new Error(`Data checksum mismatch: ${asset.file}`);
}
console.log(`Static viewer ready: ${manifest.neurons.toLocaleString('en-US')} neurons; ${manifest.assets.length} data assets verified.`);
console.log('Output directory: dist. Simulation engine is not included in this build.');
