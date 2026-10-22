// Chef d'orchestre des événements publics de la Grande Place. Ils suivent le CALENDRIER (horaires
// annoncés à l'avance, plusieurs manches pendant le créneau) ; un événement « surprise » peut aussi
// tomber de temps en temps. Les PNJ du quartier participent (et peuvent gagner !). L'autorité valide
// les actions des joueurs (attraper un poulet, ramasser une citrouille, danser) et distribue le podium.
import { EVENT_RULES } from './content/events.js';
import { invasionChickenCount, invasionChickens, invasionChickenPos, pumpkinSet } from './minigame-logic.js';
import { POI, dist2d } from './world-layout.js';
import { randInt, pick, shuffle } from './rng.js';
import { liveOf, CAL_BY_ID } from './calendar.js';

const NPC_PLAYERS = ['Mamie Turbo', 'Kevin', 'Paulette', 'Gérard', 'Coach Biscotte', 'Josiane', 'Momo', 'Lulu'];

export class EventDirector {
  constructor(getContent, { rand, playerCount, onStart, onUpdate, onEnd, now, calNow }) {
    this.getContent = getContent;
    this.rand = rand;
    this.playerCount = playerCount;
    this.calNow = calNow || ((t) => t);
    this.onStart = onStart || (() => {});
    this.onUpdate = onUpdate || (() => {});
    this.onEnd = onEnd || (() => {});
    this.current = null;
    this.lastEndAt = 0;
    this.nextAutoAt = (now ?? Date.now()) + EVENT_RULES.surpriseEveryMs * (0.6 + this.rand() * 0.6);
  }

  canStart(id, now) {
    if (!this.getContent().events[id]) return 'Événement inconnu.';
    if (this.current) return 'Un événement est déjà en cours !';
    const wait = this.lastEndAt + EVENT_RULES.cooldownMs - now;
    if (wait > 0) return `Les habitants se remettent du dernier événement. Réessaie dans ${Math.ceil(wait / 1000)} s.`;
    return null;
  }

  start(id, now, by = 'La Mairie', occ = null) {
    const ev = this.getContent().events[id];
    const seed = randInt(this.rand, 1, 2 ** 31 - 2);
    const c = { id, seed, startsAt: now, endsAt: now + ev.duration * 1000, by, occ, scores: new Map() };
    if (id === 'invasion') { c.n = invasionChickenCount(this.playerCount()); c.chickens = invasionChickens(seed, c.n); c.caught = new Map(); }
    if (id === 'chasse-citrouilles') { c.n = Math.min(30, ev.pumpkins + this.playerCount() * 2); c.pumpkins = pumpkinSet(seed, c.n); c.taken = new Map(); }
    if (id === 'soiree-dj') { c.ticks = new Map(); }
    // PNJ participants : chacun son rythme (certains rapides, d'autres se dispersent)
    c.npcs = shuffle(this.rand, NPC_PLAYERS).slice(0, 3 + Math.floor(this.rand() * 2)).map((name) => {
      const every = 5 + this.rand() * 9;
      return { name, every, next: now + (3 + every * (0.5 + this.rand())) * 1000 };
    });
    this.current = c;
    this.onStart(this.publicState());
    return c;
  }

  publicState() {
    const c = this.current;
    if (!c) return null;
    const ev = this.getContent().events[c.id];
    return {
      id: c.id, name: ev.name, emoji: ev.emoji, desc: ev.desc, seed: c.seed, startsAt: c.startsAt, endsAt: c.endsAt, by: c.by, n: c.n, occ: c.occ,
      caught: c.caught ? [...c.caught.keys()] : undefined, taken: c.taken ? [...c.taken.keys()] : undefined,
      npcs: c.npcs.map((x) => x.name),
      top: this.ranking().slice(0, 5).map((r) => ({ name: r.name, n: r.n, npc: r.npc })),
    };
  }

  ranking() {
    if (!this.current) return [];
    return [...this.current.scores.entries()].map(([id, s]) => ({ id, name: s.name, n: s.n, npc: !!s.npc })).sort((a, b) => b.n - a.n);
  }

  score(profile, add = 1, npc = false) {
    const key = npc ? `npc:${profile.name}` : profile.id;
    const s = this.current.scores.get(key) || { name: profile.name, n: 0, npc };
    s.n += add;
    this.current.scores.set(key, s);
  }

  // Les PNJ jouent : ils attrapent des poulets posés, ramassent des citrouilles, dansent.
  npcStep(now) {
    const c = this.current, t = (now - c.startsAt) / 1000;
    for (const npc of c.npcs) {
      if (now < npc.next) continue;
      npc.next = now + npc.every * (0.7 + this.rand() * 0.6) * 1000;
      if (c.id === 'invasion') {
        const free = c.chickens.filter((ch) => !c.caught.has(ch.i) && invasionChickenPos(ch, t).landed);
        if (!free.length) continue;
        const ch = pick(this.rand, free);
        c.caught.set(ch.i, npc.name);
        this.score({ name: npc.name }, 1, true);
        this.onUpdate({ id: c.id, caught: ch.i, by: npc.name, npc: true, top: this.publicState().top });
      } else if (c.id === 'chasse-citrouilles') {
        const free = c.pumpkins.filter((pk) => !c.taken.has(pk.i));
        if (!free.length) continue;
        const pk = pick(this.rand, free);
        c.taken.set(pk.i, npc.name);
        this.score({ name: npc.name }, 1, true);
        this.onUpdate({ id: c.id, taken: pk.i, by: npc.name, npc: true, top: this.publicState().top });
      } else if (c.id === 'soiree-dj') {
        this.score({ name: npc.name }, 1, true);
      }
    }
  }

  // Action d'un joueur pendant l'événement (validée avec la position connue par l'autorité).
  action(profile, pos, now, { kind, ...a }) {
    const c = this.current;
    if (!c || now > c.endsAt + 1000) return { ok: false, error: 'Aucun événement en cours.' };
    const ev = this.getContent().events[c.id];
    const t = (now - c.startsAt) / 1000;
    if (!pos) return { ok: false, error: 'Position inconnue.' };
    if (c.id === 'invasion' && kind === 'catch') {
      const ch = c.chickens[a.chicken];
      if (!ch || c.caught.has(ch.i)) return { ok: false, error: 'Trop tard, quelqu\'un l\'a eu !' };
      // tolérance : on compare avec la position du poulet un peu avant/après (latence réseau)
      let okNear = false;
      for (const dt of [0, -0.25, -0.5, -0.75, 0.25]) {
        const cp = invasionChickenPos(ch, t + dt);
        if (cp.landed && dist2d(pos.x, pos.z, cp.x, cp.z) <= 3.6) { okNear = true; break; }
      }
      if (!okNear) return { ok: false, error: 'Raté ! Il s\'est échappé.' };
      c.caught.set(ch.i, profile.name);
      this.score(profile);
      this.onUpdate({ id: c.id, caught: ch.i, by: profile.name, top: this.publicState().top });
      return { ok: true, coins: ch.golden ? ev.reward.golden : ev.reward.perCatch, rep: ev.rep.perCatch, golden: ch.golden, caught: ch.i };
    }
    if (c.id === 'chasse-citrouilles' && kind === 'pumpkin') {
      const pk = c.pumpkins[a.pumpkin];
      if (!pk || c.taken.has(pk.i)) return { ok: false, error: 'Déjà ramassée !' };
      if (dist2d(pos.x, pos.z, pk.x, pk.z) > 3.5) return { ok: false, error: 'Trop loin.' };
      c.taken.set(pk.i, profile.name);
      this.score(profile);
      this.onUpdate({ id: c.id, taken: pk.i, by: profile.name, top: this.publicState().top });
      return { ok: true, coins: ev.reward.perPumpkin, rep: ev.rep.perPumpkin, taken: pk.i };
    }
    if (c.id === 'soiree-dj' && kind === 'dance') {
      const F = POI.danceFloor;
      if (Math.abs(pos.x - F.x) > F.w / 2 + 1 || Math.abs(pos.z - F.z) > F.d / 2 + 1) return { ok: false, error: 'Va sur la piste de danse !' };
      const tk = c.ticks.get(profile.id) || { n: 0, last: 0 };
      if (now - tk.last < ev.tick * 1000 - 400) return { ok: false, error: 'Continue de danser...' };
      if (tk.n >= ev.reward.maxTicks) return { ok: false, error: 'Tu as tout donné ! Repose tes jambes.' };
      tk.n++; tk.last = now;
      c.ticks.set(profile.id, tk);
      this.score(profile);
      return { ok: true, coins: ev.reward.perTick, rep: ev.rep.perTick };
    }
    return { ok: false, error: 'Action impossible.' };
  }

  // Événement du calendrier en cours (créneau ouvert) pour la Grande Place.
  scheduled(now) {
    return liveOf((e) => e.kind === 'public' && !!this.getContent().events[e.event], this.calNow(now))[0] || null;
  }

  // À appeler régulièrement : PNJ, fin des manches, manches du calendrier, surprises.
  tick(now) {
    const c = this.current;
    if (c) {
      this.npcStep(now);
      const allDone = (c.caught && c.caught.size >= c.n) || (c.taken && c.taken.size >= c.n);
      if (now >= c.endsAt || allDone) this.end(now);
      return;
    }
    const o = this.scheduled(now);
    if (o && now - this.lastEndAt > EVENT_RULES.roundPauseMs) {
      const cal = CAL_BY_ID[o.id];
      this.start(cal.event, now, cal.name, o.occ);
      return;
    }
    if (now >= this.nextAutoAt && this.playerCount() > 0) {
      const ids = Object.keys(this.getContent().events);
      this.start(pick(this.rand, ids), now, 'Surprise de la Mairie');
    }
  }

  end(now) {
    const c = this.current;
    const ev = this.getContent().events[c.id];
    const rank = this.ranking();
    // le podium se joue contre tout le monde (PNJ compris) ; seuls les joueurs reçoivent des PlayCoins
    const podium = [];
    rank.slice(0, 3).forEach((r, i) => {
      if (r.n <= 0) return;
      podium.push({ id: r.npc ? null : r.id, name: r.name, npc: r.npc, n: r.n, place: i + 1, coins: r.npc ? 0 : ev.reward.podium?.[i] || 0, rep: r.npc ? 0 : ev.rep.podium?.[i] || 0 });
    });
    this.current = null;
    this.lastEndAt = now;
    if (!c.occ) this.nextAutoAt = now + EVENT_RULES.surpriseEveryMs * (0.75 + this.rand() * 0.5);
    this.onEnd({ id: c.id, name: ev.name, occ: c.occ, ranking: rank.slice(0, 10), podium });
  }
}
