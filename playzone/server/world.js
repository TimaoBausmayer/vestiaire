// Mondes (instances) du serveur : joueurs connectés, positions vérifiées, autorité du jeu,
// événements, chat, groupes, invitations. Toute récompense est décidée ici, jamais par le client.
import { randomBytes } from 'node:crypto';
import { Authority } from '../shared/authority.js';
import { EventDirector } from '../shared/events-director.js';
import { buildContent } from '../shared/content/registry.js';
import { LIMITS, SPEED } from '../shared/protocol.js';
import { censor, hasPersonalInfo } from '../shared/chat-filter.js';
import { POI, MINIGAME_SPOTS, HOME_INTERIOR, BUILDING_BY_ID, inBounds, dist2d } from '../shared/world-layout.js';
import { maxSpeedOf } from '../shared/content/vehicles.js';
import { HOUSING_BY_ID } from '../shared/property.js';
import { CompanyRegistry } from './companies.js';
import { bodyEffects } from '../shared/body.js';

// Silhouette publique (poids, muscles, torse nu) pour les autres joueurs.
function physiqueOf(p) {
  if (!p.body) return {};
  const fx = bodyEffects(p.body);
  return { fat: Math.round(fx.fat * 10) / 10, strong: Math.round(fx.strong * 10) / 10, ...(p.body.shirtless ? { top: 'torse' } : {}) };
}

const POSES = new Set(['idle', 'carry', 'spray', 'wave', 'throw', 'celebrate', 'cook', 'pet', 'sit', 'hold-forward', 'dance', 'eat']);
const newId = () => randomBytes(6).toString('hex');
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const r2 = (v) => Math.round(v * 100) / 100;

export class Player {
  constructor(conn, profile) {
    this.conn = conn;
    this.id = profile.id;
    this.profile = profile;
    this.session = {};
    this.pos = { x: POI.spawn.x, y: 0, z: POI.spawn.z };
    this.state = { ry: 0, s: 0, p: 'idle', d: 0, g: 1, w: 0, v: null };
    this.zone = 'world';
    this.credit = SPEED.creditMax;
    this.lastStateAt = Date.now();
    this.chatTimes = [];
    this.chatLog = [];
    this.party = null;
    this.partyInvites = new Set();
    this.homeInvites = new Set();
    this.visitAllowed = null;
    this.violations = 0;
    this.dirty = false;
    this.duty = null;
  }
  get name() { return this.profile.name; }
  get tag() { return this.id.slice(-4); }
  send(o) { this.conn.send(o); }
  publicInfo() {
    const p = this.profile;
    const pet = p.pets.find((x) => x.id === p.activePet);
    return {
      id: this.id, name: p.name, tag: this.tag, appearance: p.appearance, zone: this.zone, duty: this.duty, phy: physiqueOf(p),
      pet: pet ? { id: pet.id, species: pet.species, name: pet.name, collar: pet.collar, tricks: pet.tricks } : null,
      level: p.xp, titles: p.titles,
    };
  }
}

export class GameServer {
  constructor(db, { log = console.log } = {}) {
    this.db = db;
    this.log = log;
    this.content = buildContent(Date.now());
    this.authority = new Authority(this.content);
    this.leaderboard = db.leaderboard((mg) => this.content.minigames[mg]?.kind === 'time');
    this.worlds = [];
    this.online = new Map(); // id -> Player
    this.housing = new HousingRegistry(db);
    this.companies = new CompanyRegistry(this);
    this.timer = setInterval(() => this.tick(), 1000 / LIMITS.snapshotHz);
    this.contentTimer = setInterval(() => { this.content = buildContent(Date.now()); this.authority.setContent(this.content); }, 60_000);
  }

  stop() { clearInterval(this.timer); clearInterval(this.contentTimer); this.saveAll(); }

  playerCount() { return this.online.size; }

  status() {
    return { game: 'playzone', players: this.online.size, worlds: this.worlds.map((w) => ({ id: w.id, name: w.name, players: w.players.size })), packs: this.content.packs.map((p) => p.id), time: Date.now() };
  }

  join(conn, profile) {
    const old = this.online.get(profile.id);
    if (old) { old.send({ t: 'kick', reason: 'Tu t\'es connecté depuis un autre appareil.' }); old.conn.close(); this.leave(old); }
    let w = this.worlds.find((x) => x.players.size < LIMITS.playersPerWorld);
    if (!w) { w = new World(this, this.worlds.length + 1); this.worlds.push(w); }
    const p = new Player(conn, this.authority.migrate(profile));
    this.authority.startSession(p.profile, Date.now());
    this.online.set(p.id, p);
    w.add(p);
    return p;
  }

  leave(p) {
    if (!p.world) return;
    p.world.remove(p);
    if (this.online.get(p.id) === p) this.online.delete(p.id);
    if (p.dirty) this.save(p);
  }

  save(p) { try { this.db.saveProfile(p.profile); p.dirty = false; } catch (e) { this.log('[db] save', e.message); } }
  saveAll() { for (const p of this.online.values()) if (p.dirty) this.save(p); }

  tick() {
    const now = Date.now();
    for (const w of this.worlds) w.tick(now);
    if (!this._saveAt || now - this._saveAt > 2000) { this._saveAt = now; this.saveAll(); }
  }
}

export class World {
  constructor(server, n) {
    this.server = server;
    this.id = `w${n}`;
    this.name = `Monde ${n}`;
    this.players = new Map();
    this.parties = new Map();
    this.director = new EventDirector(() => server.content, {
      rand: Math.random,
      playerCount: () => this.players.size,
      onStart: (st) => this.broadcast({ t: 'event.start', ...st }),
      onUpdate: (u) => this.broadcast({ t: 'event.update', ...u }),
      onEnd: (r) => this.onEventEnd(r),
    });
  }

  broadcast(o, except) { for (const p of this.players.values()) if (p !== except) p.send(o); }

  add(p) {
    p.world = this;
    this.players.set(p.id, p);
    p.send({ t: 'welcome', id: p.id, profile: p.profile, serverTime: Date.now(), world: { id: this.id, name: this.name }, event: this.director.publicState(), players: [...this.players.values()].filter((q) => q !== p).map((q) => ({ ...q.publicInfo(), ...this.stateOf(q) })) });
    this.broadcast({ t: 'join', ...p.publicInfo(), ...this.stateOf(p) }, p);
    this.broadcast({ t: 'sys', text: `${p.name} est arrivé à PLAYZONE.` }, p);
  }

  remove(p) {
    this.players.delete(p.id);
    this.leaveParty(p);
    this.broadcast({ t: 'leave', id: p.id });
    this.broadcast({ t: 'sys', text: `${p.name} est parti.` });
  }

  stateOf(p) {
    const s = p.state;
    return { x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), ry: r2(s.ry), s: s.s, p: s.p, d: s.d, g: s.g, w: s.w, v: s.v, c: s.c, zone: p.zone };
  }

  tick(now) {
    this.director.tick(now);
    // factures (loyer, crédit, charges) : prélevées chaque minute de jeu
    if (!this._billAt || now - this._billAt > 60_000) {
      this._billAt = now;
      for (const p of this.players.values()) {
        const res = this.server.authority.handle(this.ctx(p), 'bills.tick', {});
        if (res.ok && res.changed) { p.dirty = true; p.send({ t: 'profile', profile: p.profile }); if (res.data?.paid || res.data?.evicted || res.data?.bankrupt) p.send({ t: 'bills', ...res.data }); }
      }
    }
    // instantanés : seulement les joueurs de la même zone et assez proches (gestion d'intérêt)
    const list = [...this.players.values()];
    for (const p of list) {
      const near = [];
      for (const q of list) {
        if (q === p || q.zone !== p.zone) continue;
        if (dist2d(p.pos.x, p.pos.z, q.pos.x, q.pos.z) > LIMITS.interestRadius) continue;
        const s = this.stateOf(q);
        near.push([q.id, s.x, s.y, s.z, s.ry, s.s, s.p, s.d, s.g, s.w, s.v, s.c]);
      }
      p.send({ t: 'snap', at: now, l: near });
    }
  }

  ctx(p) {
    const s = this.server;
    return {
      profile: p.profile, session: p.session, now: Date.now(), pos: p.pos, zone: p.zone, rand: Math.random, newId,
      leaderboard: s.leaderboard, events: this.director, log: s.log, housing: s.housing, companies: s.companies,
    };
  }

  // ------------------------------------------------------------------ messages
  handle(p, m) {
    switch (m.t) {
      case 'req': return this.onReq(p, m);
      case 'state': return this.onState(p, m.s, m.zone);
      case 'tp': return this.onTeleport(p, m.to);
      case 'chat': return this.onChat(p, m.text, m.channel);
      case 'party': return this.onParty(p, m);
      case 'invite': return this.onInvite(p, m);
      case 'visit': return this.onVisit(p, m.host);
      case 'house': return this.onHouse(p, m.id);
      case 'report': return this.onReport(p, m);
      case 'ping': return p.send({ t: 'pong', c: m.c, s: Date.now() });
      default: return null;
    }
  }

  onReq(p, m) {
    if (typeof m.type !== 'string' || m.type.length > 40) return;
    const before = p.duty;
    const res = this.server.authority.handle(this.ctx(p), m.type, m.payload && typeof m.payload === 'object' ? m.payload : {});
    p.send({ t: 'res', id: m.id, ok: res.ok, data: res.data, error: res.error });
    if (!res.ok) return;
    if (res.changed) { p.dirty = true; p.send({ t: 'profile', profile: p.profile }); }
    // effets visibles par les autres joueurs
    p.duty = p.session.mission?.job || null;
    if (m.type === 'avatar.update' || m.type.startsWith('pet.') || /^(body|gym|hair|company)\./.test(m.type) || p.duty !== before) this.broadcast({ t: 'pupdate', ...p.publicInfo() }, p);
    if (m.type.startsWith('home.') || m.type === 'shop.buy') this.pushHome(p);
  }

  // Intérieur d'une maison de joueur (meubles du propriétaire, en ligne ou non).
  onHouse(p, id) {
    if (typeof id !== 'string') return;
    const o = this.server.housing.map.get(id);
    if (!o) { p.send({ t: 'house_data', id, owner: null }); return; }
    const host = this.server.online.get(o.pid);
    const prof = host ? host.profile : this.server.db.profileById(o.pid);
    const home = prof?.home?.place === id ? prof.home : { furniture: [] };
    p.send({ t: 'house_data', id, owner: { id: o.pid, name: o.name }, home: { furniture: home.furniture, open: !!prof?.home?.open } });
  }

  // Envoie la déco à jour aux visiteurs présents chez p.
  pushHome(host) {
    const place = host.profile.home.place;
    if (place && place !== 'studio' && HOUSING_BY_ID[place]?.kind !== 'appart') for (const q of this.players.values()) if (q !== host) this.onHouse(q, place);
    for (const q of this.players.values()) if (q.zone === `home:${host.id}` && q !== host) q.send({ t: 'home_data', host: host.id, name: host.name, home: host.profile.home });
  }

  correct(p) { p.send({ t: 'correct', x: p.pos.x, y: p.pos.y, z: p.pos.z, zone: p.zone }); }

  onState(p, s, zone) {
    if (!s || typeof s !== 'object') return;
    const x = num(s.x, NaN), y = num(s.y, NaN), z = num(s.z, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || y < -15 || y > 80) return;
    const now = Date.now();
    const dt = Math.min(1, Math.max(0.001, (now - p.lastStateAt) / 1000));
    p.lastStateAt = now;
    zone = typeof zone === 'string' ? zone.slice(0, 40) : p.zone;
    if (zone !== p.zone) {
      if (!this.allowZone(p, zone, x, z)) { this.correct(p); return; }
      p.zone = zone;
      p.pos = { x, y, z };
      p.credit = SPEED.creditMax;
      return;
    }
    // vitesse : distance autorisée + crédit (gigue réseau, petits sauts autorisés)
    const vehicle = typeof s.v === 'string' ? p.profile.vehicles.find((v) => v.model === s.v) : null;
    const max = vehicle ? maxSpeedOf(vehicle.model) : SPEED.foot;
    p.credit = Math.min(SPEED.creditMax, p.credit + SPEED.creditRefill * dt);
    const d = dist2d(p.pos.x, p.pos.z, x, z);
    const allowed = max * dt + 0.35;
    if (d > allowed) {
      const extra = d - allowed;
      if (extra > p.credit) {
        p.violations++;
        if (p.violations % 20 === 1) this.server.log(`[anti-triche] ${p.name} : déplacement refusé (${d.toFixed(1)} m en ${dt.toFixed(2)} s)`);
        this.correct(p);
        return;
      }
      p.credit -= extra;
    }
    // limites de la zone
    if (zone === 'world' && !inBounds(x, z, 6)) { this.correct(p); return; }
    if (zone.startsWith('home:') && (Math.abs(x - HOME_INTERIOR.origin.x) > 12 || Math.abs(z - HOME_INTERIOR.origin.z) > 9)) { this.correct(p); return; }
    p.pos = { x, y, z };
    p.state = {
      ry: num(s.ry), s: Math.min(45, Math.max(0, num(s.s))), p: POSES.has(s.p) ? s.p : 'idle', d: Math.min(2, Math.max(0, num(s.d) | 0)),
      g: s.g ? 1 : 0, w: s.w ? 1 : 0, v: vehicle ? vehicle.model : null, c: vehicle ? vehicle.color : null,
    };
    this.server.authority.onPosition(this.ctx(p));
  }

  allowZone(p, zone, x, z) {
    // entrées possibles : porte de la Résidence Les Mouettes, ou hall de l'immeuble de l'appartement
    const entries = [POI.homeDoor];
    for (const pr of p.profile.properties || []) { const h = HOUSING_BY_ID[pr.id]; if (h?.kind === 'appart') entries.push(BUILDING_BY_ID[h.building]); }
    const nearEntry = (px, pz, r) => entries.some((e) => e && dist2d(px, pz, e.x, e.z) < r + (e.w ? Math.max(e.w, e.d) / 2 : 0));
    if (zone === 'world') {
      if (!p.zone.startsWith('home:')) return false;
      return nearEntry(x, z, 8) || [...Object.values(BUILDING_BY_ID)].some((b) => b.interior === 'lobby' && dist2d(x, z, b.x, b.z) < Math.max(b.w, b.d) / 2 + 6);
    }
    if (zone === `home:${p.id}`) return p.zone === 'world' && nearEntry(p.pos.x, p.pos.z, 9);
    if (zone.startsWith('home:')) {
      const host = zone.slice(5);
      return p.visitAllowed === host && (p.zone === 'world' || p.zone.startsWith('home:'));
    }
    return false;
  }

  // Téléportations autorisées (ex. retour au dernier anneau du parcours après une chute dans la boue).
  onTeleport(p, to) {
    if (to === 'checkpoint' && p.session.mg?.id === 'parcours') {
      const cps = MINIGAME_SPOTS.obstacle.checkpoints;
      const c = p.session.mg.next > 0 ? cps[p.session.mg.next - 1] : { x: MINIGAME_SPOTS.obstacle.x, y: 0, z: MINIGAME_SPOTS.obstacle.z };
      p.pos = { x: c.x, y: c.y, z: c.z };
      p.credit = SPEED.creditMax;
    }
  }

  // ------------------------------------------------------------------ chat (filtré, limité)
  onChat(p, text, channel) {
    if (typeof text !== 'string') return;
    text = text.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.chatLen);
    if (!text) return;
    const now = Date.now();
    p.chatTimes = p.chatTimes.filter((t) => now - t < LIMITS.chatWindowMs);
    if (p.chatTimes.length >= LIMITS.chatRate) { p.send({ t: 'sys', text: 'Doucement ! Tu envoies trop de messages.' }); return; }
    if (text === p.lastChat && now - p.lastChatAt < 15_000) { p.send({ t: 'sys', text: 'Message déjà envoyé.' }); return; }
    if (hasPersonalInfo(text)) { p.send({ t: 'sys', text: 'Pour ta sécurité, les liens et numéros de téléphone sont interdits dans le chat.' }); return; }
    p.chatTimes.push(now);
    p.lastChat = text; p.lastChatAt = now;
    const clean = censor(text);
    p.chatLog.push({ at: now, text: clean });
    if (p.chatLog.length > 20) p.chatLog.shift();
    const msg = { t: 'chat', from: p.id, name: p.name, tag: p.tag, text: clean, channel: channel === 'party' && p.party ? 'party' : 'local' };
    if (msg.channel === 'party') { for (const id of p.party.members) this.players.get(id)?.send(msg); return; }
    for (const q of this.players.values()) {
      if (q.zone === p.zone && dist2d(q.pos.x, q.pos.z, p.pos.x, p.pos.z) <= LIMITS.chatRadius) q.send(msg);
    }
  }

  // ------------------------------------------------------------------ groupes
  onParty(p, m) {
    const target = typeof m.target === 'string' ? this.players.get(m.target) : null;
    if (m.action === 'invite' && target && target !== p) {
      if (target.party && target.party === p.party) return;
      target.partyInvites.add(p.id);
      target.send({ t: 'invite', kind: 'party', from: p.id, name: p.name });
      p.send({ t: 'sys', text: `Invitation envoyée à ${target.name}.` });
    } else if (m.action === 'accept' && target && p.partyInvites.has(target.id)) {
      p.partyInvites.delete(target.id);
      let party = target.party;
      if (!party) { party = { id: newId(), leader: target.id, members: new Set([target.id]) }; target.party = party; this.parties.set(party.id, party); }
      if (party.members.size >= 6) { p.send({ t: 'sys', text: 'Ce groupe est complet.' }); return; }
      this.leaveParty(p);
      party.members.add(p.id);
      p.party = party;
      this.sendParty(party);
    } else if (m.action === 'leave') {
      this.leaveParty(p);
      p.send({ t: 'party', party: null });
    }
  }

  leaveParty(p) {
    const party = p.party;
    if (!party) return;
    party.members.delete(p.id);
    p.party = null;
    if (party.leader === p.id) party.leader = [...party.members][0];
    if (party.members.size <= 1) {
      for (const id of party.members) { const q = this.players.get(id); if (q) { q.party = null; q.send({ t: 'party', party: null }); } }
      this.parties.delete(party.id);
    } else this.sendParty(party);
  }

  sendParty(party) {
    const info = { id: party.id, leader: party.leader, members: [...party.members].map((id) => ({ id, name: this.players.get(id)?.name })) };
    for (const id of party.members) this.players.get(id)?.send({ t: 'party', party: info });
  }

  // ------------------------------------------------------------------ invitations chez soi
  onInvite(p, m) {
    const target = typeof m.target === 'string' ? this.players.get(m.target) : null;
    if (!target || target === p || m.kind !== 'home') return;
    target.homeInvites.add(p.id);
    target.send({ t: 'invite', kind: 'home', from: p.id, name: p.name });
    p.send({ t: 'sys', text: `${target.name} est invité chez toi.` });
  }

  onVisit(p, hostId) {
    const host = typeof hostId === 'string' ? this.players.get(hostId) : null;
    if (!host || !p.homeInvites.has(hostId)) { p.send({ t: 'sys', text: 'Cette invitation n\'est plus valable.' }); return; }
    if (p.zone !== 'world' || dist2d(p.pos.x, p.pos.z, POI.homeDoor.x, POI.homeDoor.z) > 9) {
      p.send({ t: 'sys', text: `Rejoins d'abord la Résidence Les Mouettes (porte d'entrée) pour aller chez ${host.name}.` });
      p.send({ t: 'visit_hint' });
      return;
    }
    p.visitAllowed = hostId;
    p.send({ t: 'home_data', host: host.id, name: host.name, home: host.profile.home, enter: true });
  }

  onReport(p, m) {
    const target = typeof m.target === 'string' ? this.players.get(m.target) : null;
    if (!target) return;
    this.server.db.report(p.id, target.id, typeof m.reason === 'string' ? m.reason : 'non précisé', target.chatLog);
    this.server.log(`[signalement] ${p.name} a signalé ${target.name} : ${m.reason}`);
    p.send({ t: 'sys', text: 'Merci, ton signalement a été enregistré. Tu peux aussi masquer ce joueur.' });
  }

  onEventEnd(r) {
    for (const pod of r.podium) {
      const p = this.players.get(pod.id);
      if (!p) continue;
      this.server.authority.addCoins(p.profile, pod.coins);
      p.profile.rep += pod.rep;
      p.dirty = true;
      p.send({ t: 'profile', profile: p.profile });
    }
    this.broadcast({ t: 'event.end', ...r });
  }
}

// Qui habite / possède quel logement (unicité des maisons et appartements entre joueurs).
export class HousingRegistry {
  constructor(db) {
    this.map = new Map(); // id du logement -> { pid, name }
    try {
      for (const prof of db.allProfiles?.() || []) for (const pr of prof.properties || []) if (pr.id !== 'studio') this.map.set(pr.id, { pid: prof.id, name: prof.name });
    } catch { /* base vide */ }
  }
  owner(id, self) { const o = this.map.get(id); return o && o.pid !== self ? o.name : null; }
  claim(id, p) { if (id !== 'studio') this.map.set(id, { pid: p.id, name: p.name }); }
  release(id, pid) { if (this.map.get(id)?.pid === pid) this.map.delete(id); }
}
