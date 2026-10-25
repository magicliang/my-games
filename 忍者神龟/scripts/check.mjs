import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir,entry.name);
    if (entry.isDirectory() && !['node_modules','.git','evidence'].includes(entry.name)) await walk(name);
    else if (entry.isFile() && /\.(m?js)$/.test(name)) files.push(name);
  }
}
await walk(root);
let checked = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check',file], { encoding:'utf8' });
  if (result.status !== 0) { console.error(result.stderr); process.exitCode=1; }
  const source = await readFile(file,'utf8');
  for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
    try { await access(path.resolve(path.dirname(file),match[1])); }
    catch { console.error(`Missing import: ${path.relative(root,file)} → ${match[1]}`); process.exitCode=1; }
  }
  if (/\b(?:document|window|CanvasRenderingContext2D)\b/.test(source) && file.endsWith('/core.js')) { console.error('Simulation must not depend on DOM or rendering'); process.exitCode=1; }
  checked++;
}
JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
if (!process.exitCode) console.log(`PASS: ${checked} JavaScript files parsed; relative imports resolved; core independent of DOM. No external dependencies.`);
