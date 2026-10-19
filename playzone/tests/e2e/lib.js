// Outils de test de bout en bout : serveur statique + Chromium sans écran (WebGL logiciel).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* suivant */ }
  }
  throw new Error('Playwright introuvable');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

export function staticServer(port = 0) {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      try {
        await stat(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(await readFile(file));
      } catch { res.writeHead(404).end('404'); }
    });
    srv.listen(port, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

export async function launch({ width = 1280, height = 720, mobile = false } = {}) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  return { browser, context };
}

export function watchConsole(page, tag = '') {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = `${tag}[${m.type()}] ${m.text()}`; if (!/GPU stall|Automatic fallback to software WebGL|GL_CLOSE_PATH/.test(t)) errors.push(t); } });
  page.on('pageerror', (e) => errors.push(`${tag}[pageerror] ${e.message}\n${e.stack}`));
  return errors;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
