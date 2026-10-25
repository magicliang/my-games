import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('文件不存在'); }
});
server.listen(Number(process.env.PORT || 4175), '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`忍者神龟 · 本地入口 ${url}`);
  if (process.argv.includes('--open') && process.platform === 'darwin') execFile('open', [url]);
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? '4175 端口已被占用。游戏可能已启动，打开 http://127.0.0.1:4175；或用 PORT=4176 npm start。' : error.message);
  process.exitCode = 1;
});
