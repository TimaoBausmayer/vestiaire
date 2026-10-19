// Serveur PLAYZONE : sert le jeu (fichiers statiques) + WebSocket multijoueur + API d'état.
// Lancement : npm start (variables : PORT=8080, HOST=0.0.0.0, DB=server/data/playzone.db)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { DB } from './db.js';
import { GameServer } from './world.js';
import { LIMITS, PROTOCOL_VERSION } from '../shared/protocol.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DB_FILE = process.env.DB || join(ROOT, 'server', 'data', 'playzone.db');
// Seuls ces dossiers sont servis (jamais server/, tests/, node_modules/...).
const PUBLIC = ['/index.html', '/style.css', '/src/', '/shared/', '/vendor/', '/assets/'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

export function startServer({ port = PORT, host = HOST, dbFile = DB_FILE, quiet = false, accountsPerIp = +(process.env.ACCOUNTS_PER_IP || LIMITS.accountsPerIpPerHour) } = {}) {
  const say = quiet ? () => {} : log;
  const db = new DB(dbFile);
  const game = new GameServer(db, { log: say });

  const http = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p === '/api/status') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(game.status()));
      return;
    }
    if (p === '/' || p === '') p = '/index.html';
    if (!PUBLIC.some((pre) => p === pre || (pre.endsWith('/') && p.startsWith(pre)))) { res.writeHead(404).end('Introuvable'); return; }
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error('pas un fichier');
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] || 'application/octet-stream',
        'cache-control': p.startsWith('/vendor/') ? 'public, max-age=86400' : 'no-cache',
        'x-content-type-options': 'nosniff',
      });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end('Introuvable'); }
  });

  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: LIMITS.maxPayload });
  wss.on('connection', (ws, req) => {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
    const ipHash = createHash('sha256').update(`playzone:${ip}`).digest('hex').slice(0, 24);
    const conn = {
      ip, ipHash,
      send: (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); },
      close: () => ws.close(),
    };
    let player = null;
    let tokens = LIMITS.msgBurst, last = Date.now(), drops = 0;
    ws.on('message', (raw) => {
      // limiteur de débit (seau à jetons)
      const now = Date.now();
      tokens = Math.min(LIMITS.msgBurst, tokens + ((now - last) / 1000) * LIMITS.msgRate);
      last = now;
      if (tokens < 1) { if (++drops > 200) { conn.send({ t: 'kick', reason: 'Trop de messages.' }); ws.close(); } return; }
      tokens -= 1;
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
      try {
        if (!player) {
          if (m.t === 'hello') {
            if (m.v !== PROTOCOL_VERSION) { conn.send({ t: 'kick', reason: 'Version du jeu dépassée : recharge la page.' }); ws.close(); return; }
            const row = typeof m.token === 'string' && m.token.length <= 128 ? db.findByToken(m.token) : null;
            if (row) { player = game.join(conn, row.profile); say(`[+] ${player.name} (${game.playerCount()} en ligne)`); } else conn.send({ t: 'welcome', needProfile: true, serverTime: Date.now() });
          } else if (m.t === 'create') {
            if (db.accountsFromIp(ipHash, Date.now() - 3600_000) >= accountsPerIp) { conn.send({ t: 'create_error', error: 'Trop de personnages créés depuis cette connexion. Réessaie plus tard.' }); return; }
            let profile;
            try { profile = game.authority.newProfile({ id: `p_${randomBytes(8).toString('hex')}`, name: m.name, appearance: m.appearance, now: Date.now() }); } catch (e) { conn.send({ t: 'create_error', error: e.message }); return; }
            const token = randomBytes(24).toString('hex');
            db.createPlayer(profile, token, ipHash);
            conn.send({ t: 'created', token });
            player = game.join(conn, profile);
            say(`[nouveau] ${player.name} (${game.playerCount()} en ligne)`);
          } else if (m.t === 'ping') conn.send({ t: 'pong', c: m.c, s: Date.now() });
          return;
        }
        player.world.handle(player, m);
      } catch (e) { say('[erreur]', e.stack || e); }
    });
    ws.on('close', () => { if (player) { game.leave(player); say(`[-] ${player.name} (${game.playerCount()} en ligne)`); } });
    ws.on('error', () => {});
  });

  return new Promise((resolve) => {
    http.listen(port, host, () => {
      const addr = http.address();
      say(`PLAYZONE en ligne sur http://${host === '0.0.0.0' ? 'localhost' : host}:${addr.port}/  (base : ${dbFile})`);
      resolve({ http, wss, game, db, port: addr.port, close: () => new Promise((r) => { game.stop(); for (const c of wss.clients) c.terminate(); wss.close(); http.close(() => r()); }) });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const srv = await startServer();
  const shutdown = () => { log('Arrêt : sauvegarde des profils...'); srv.game.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
