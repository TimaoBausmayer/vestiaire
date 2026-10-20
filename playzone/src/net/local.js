import { Authority } from '../../shared/authority.js';
import { buildContent } from '../../shared/content/registry.js';
import { EventDirector } from '../../shared/events-director.js';
import { Emitter } from '../core/emitter.js';

// MODE SOLO : l'autorité du jeu tourne dans le navigateur et la progression est sauvegardée
// localement (localStorage). Même interface que la connexion en ligne (net/online.js) :
// le reste du jeu ne fait pas la différence.

const SAVE_KEY = 'playzone.save.v1';
const BOARD_KEY = 'playzone.boards.v1';

// Records des habitants (PNJ) pour que les classements solo ne soient pas vides.
// Ils sont clairement marqués "PNJ" : ce ne sont pas de faux joueurs.
const NPC_RECORDS = {
  tartes: [['Mamie Turbo', 26], ['Kevin', 18], ['Gérard', 12], ['Le Maire', 7]],
  parcours: [['Mamie Turbo', 33.4], ['Coach Biscotte', 41.8], ['Kevin', 57.2], ['Gérard', 95]],
  poulets: [['Fermier Bidoche', 11], ['Paulette', 8], ['Kevin', 5], ['Un pigeon', 1]],
};

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, v) { try { localStorage.setItem(key, v); return true; } catch { return false; } }

class LocalBoards {
  constructor() {
    this.data = {};
    try { this.data = JSON.parse(safeGet(BOARD_KEY) || '{}'); } catch { this.data = {}; }
    for (const [id, list] of Object.entries(NPC_RECORDS)) {
      if (!this.data[id]) this.data[id] = list.map(([name, score], i) => ({ id: `npc${i}`, name, score, npc: true }));
    }
  }
  submit(mgId, profile, score, lowerBetter) {
    const list = (this.data[mgId] ||= []);
    const e = list.find((x) => x.id === profile.id);
    if (!e) list.push({ id: profile.id, name: profile.name, score });
    else if (lowerBetter ? score < e.score : score > e.score) e.score = score;
    list.sort((a, b) => (lowerBetter ? a.score - b.score : b.score - a.score));
    safeSet(BOARD_KEY, JSON.stringify(this.data));
    return list.findIndex((x) => x.id === profile.id) + 1;
  }
  top(mgId, n) { return (this.data[mgId] || []).slice(0, n); }
}

export class LocalConnection extends Emitter {
  constructor() {
    super();
    this.mode = 'solo';
    this.content = buildContent(Date.now());
    this.authority = new Authority(this.content);
    this.session = {};
    this.pos = null;
    this.zone = 'world';
    this.boards = new LocalBoards();
    this.profile = null;
    this.events = new EventDirector(() => this.content, {
      rand: Math.random,
      playerCount: () => 1,
      onStart: (st) => this.emit('event.start', st),
      onUpdate: (u) => this.emit('event.update', u),
      onEnd: (res) => this.onEventEnd(res),
    });
    this._saveTimer = null;
    setInterval(() => this.tick(), 500);
  }

  serverNow() { return Date.now(); }

  currentEvent() { return this.events.publicState(); }

  hasSave() { return !!safeGet(SAVE_KEY); }

  async connect() {
    const raw = safeGet(SAVE_KEY);
    if (raw) {
      try { this.profile = this.authority.migrate(JSON.parse(raw)); } catch { this.profile = null; }
    }
    if (this.profile) this.authority.startSession(this.profile, Date.now());
    return { profile: this.profile };
  }

  async createProfile(name, appearance, age) {
    this.profile = this.authority.newProfile({ id: `solo-${Math.random().toString(36).slice(2, 10)}`, name, appearance, now: Date.now(), age });
    this.authority.startSession(this.profile, Date.now());
    this.save(true);
    this.emit('profile', this.profile);
    return this.profile;
  }

  ctx() {
    return {
      profile: this.profile, session: this.session, now: Date.now(), pos: this.pos, zone: this.zone,
      rand: Math.random, newId: () => Math.random().toString(36).slice(2, 10), leaderboard: this.boards, events: this.events,
      log: (m) => console.warn(m),
    };
  }

  async request(type, payload) {
    if (!this.profile) throw new Error('Pas de profil.');
    this.beforeRequest?.(); // position à jour avant toute décision de l'autorité
    const res = this.authority.handle(this.ctx(), type, payload);
    if (!res.ok) throw new Error(res.error);
    if (res.changed) { this.save(); this.emit('profile', this.profile); }
    return res.data;
  }

  // Position du joueur (en ligne, le serveur la vérifie ; ici on la prend telle quelle).
  sendState(state, zone) {
    this.pos = state;
    this.zone = zone;
    if (this.profile) this.authority.onPosition(this.ctx());
  }

  tick() {
    const now = Date.now();
    if (now - this.content.now > 60_000) { this.content = buildContent(now); this.authority.setContent(this.content); }
    this.events.tick(now);
  }

  onEventEnd(res) {
    const me = res.podium.find((p) => p.id === this.profile?.id);
    if (me) { this.authority.addCoins(this.profile, me.coins); this.profile.rep += me.rep; this.save(); this.emit('profile', this.profile); }
    this.emit('event.end', res);
  }

  save(now = false) {
    clearTimeout(this._saveTimer);
    const write = () => { if (this.profile) safeSet(SAVE_KEY, JSON.stringify(this.profile)); };
    if (now) write(); else this._saveTimer = setTimeout(write, 400);
  }

  exportSave() { return JSON.stringify(this.profile); }

  importSave(text) {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object' || typeof p.name !== 'string' || typeof p.coins !== 'number') throw new Error('Fichier de sauvegarde invalide.');
    this.profile = this.authority.migrate(p);
    this.save(true);
    this.emit('profile', this.profile);
  }

  resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* rien */ } }

  // Fonctions sociales : n'existent qu'en ligne.
  chat() { return false; }
  get online() { return false; }
}
