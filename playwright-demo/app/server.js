import http from 'node:http';
import { readFile } from 'node:fs/promises';

// Explicit allowlist; demo is available only on the local loopback interface.
const routes = {
  '/': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
  '/style.css': ['style.css', 'text/css'],
};
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (path === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    res.end(`window.demoMutation = ${process.env.QA_MUTATION === '1'};`);
    return;
  }
  const route = routes[path];
  if (!route || req.method !== 'GET') {
    res.writeHead(404); res.end('Not found'); return;
  }
  try {
    const body = await readFile(new URL(route[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': `${route[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(500); res.end('Unable to load demo asset');
  }
});
server.listen(4173, '127.0.0.1', () => console.log('Workflow Lab: http://127.0.0.1:4173'));
