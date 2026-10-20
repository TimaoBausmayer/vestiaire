import { Emitter } from '../core/emitter.js';
import { buildContent } from '../../shared/content/registry.js';
import { PROTOCOL_VERSION } from '../../shared/protocol.js';

// MODE EN LIGNE : connexion WebSocket au serveur PLAYZONE. Le serveur est l'autorité : il vérifie
// les positions, décide des récompenses et sauvegarde la progression. Même interface que net/local.js.
const TOKEN_KEY = 'playzone.token';
const tokenGet = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const tokenSet = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* rien */ } };

export class OnlineConnection extends Emitter {
  constructor() {
    super();
    this.mode = 'online';
    this.offset = 0;
    this.pending = new Map();
    this.nextId = 1;
    this.profile = null;
    this.event = null;
    this.content = buildContent(Date.now());
    setInterval(() => { this.content = buildContent(this.serverNow()); }, 60_000);
  }

  get online() { return true; }

  url() {
    const u = new URL('ws', location.href);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.href;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url());
      this.ws = ws;
      const timer = setTimeout(() => { reject(new Error('le serveur ne répond pas')); ws.close(); }, 8000);
      this._onWelcome = (m) => { clearTimeout(timer); resolve(m); };
      ws.onopen = () => this.send({ t: 'hello', v: PROTOCOL_VERSION, token: tokenGet() });
      ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.onMessage(m); };
      ws.onclose = () => {
        clearTimeout(timer);
        if (!this.welcomed) { reject(new Error('connexion refusée')); return; }
        this.emit('disconnected');
        for (const p of this.pending.values()) p.reject(new Error('Connexion perdue.'));
        this.pending.clear();
        if (!this.kicked) this.reconnect();
      };
      this.pingTimer ??= setInterval(() => this.send({ t: 'ping', c: Date.now() }), 10_000);
    });
  }

  async reconnect(attempt = 1) {
    if (attempt > 6) { this.emit('lost'); return; }
    await new Promise((r) => setTimeout(r, Math.min(8000, 1000 * attempt)));
    try { this.welcomed = false; await this.connect(); this.emit('reconnected'); } catch { this.reconnect(attempt + 1); }
  }

  send(o) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(o)); }

  onMessage(m) {
    switch (m.t) {
      case 'welcome':
        this.welcomed = true;
        this.offset = m.serverTime - Date.now();
        if (m.needProfile) { this.profile = null; this._onWelcome?.(m); return; }
        this.id = m.id;
        this.profile = m.profile;
        this.worldInfo = m.world;
        this.event = m.event;
        this.initialPlayers = m.players || [];
        this.emit('welcome', m);
        this.emit('profile', this.profile);
        this._onWelcome?.(m);
        this._onCreated?.(m);
        return;
      case 'created': tokenSet(m.token); return;
      case 'create_error': this._onCreateError?.(new Error(m.error)); return;
      case 'res': {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.ok) p.resolve(m.data); else p.reject(new Error(m.error || 'Refusé par le serveur.'));
        return;
      }
      case 'profile': this.profile = m.profile; this.emit('profile', m.profile); return;
      case 'event.start': this.event = m; this.emit('event.start', m); return;
      case 'event.update': if (this.event && m.top) this.event.top = m.top; this.emit('event.update', m); return;
      case 'event.end': this.event = null; this.emit('event.end', m); return;
      case 'pong': { const rtt = Date.now() - m.c; this.rtt = rtt; this.offset = m.s + rtt / 2 - Date.now(); return; }
      case 'kick': this.kicked = true; this.emit('kick', m.reason); return;
      default: this.emit(m.t, m);
    }
  }

  createProfile(name, appearance, age) {
    return new Promise((resolve, reject) => {
      this._onCreated = () => { this._onCreated = null; resolve(this.profile); };
      this._onCreateError = (e) => { this._onCreated = null; reject(e); };
      this.send({ t: 'create', name, appearance, age });
    });
  }

  request(type, payload = {}) {
    this.beforeRequest?.(); // position à jour juste avant (le serveur décide avec SA dernière position connue)
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Le serveur ne répond pas.')); }, 8000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ t: 'req', id, type, payload });
    });
  }

  sendState(s, zone) { this.send({ t: 'state', s, zone }); }
  notifyTeleport(to) { this.send({ t: 'tp', to }); }
  chat(text, channel = 'local') { this.send({ t: 'chat', text, channel }); return true; }
  serverNow() { return Date.now() + this.offset; }
  currentEvent() { return this.event; }
}
