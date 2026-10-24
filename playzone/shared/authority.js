// AUTORITÉ DU JEU : toutes les décisions qui touchent l'argent, l'inventaire, l'XP et les récompenses.
// En ligne, ce code tourne sur le SERVEUR (le client ne fait que demander). En solo, il tourne dans le
// navigateur via net/local-authority.js. Le serveur valide avec SES positions et SON horloge.
import {
  ADDRESSES, ADDRESS_BY_ID, FIRE_SPOTS, CAT_TREES, BUILDING_BY_ID, MINIGAME_SPOTS, POI, SECRETS, SECRET_BY_ID,
  HOME_INTERIOR, groundHeight, dist2d,
} from './world-layout.js';
import { mulberry32, shuffle, randInt, pick } from './rng.js';
import {
  START_COINS, START_CASH, MAX_COINS, DAILY, MAX_PETS, levelFromXp, validName, activityFactor, recordActivity, minigameReward, todayKey,
} from './rules.js';
import { sanitizeAppearance, DEFAULT_APPEARANCE, COLORS } from './appearance.js';
import { JOB_BY_ID, jobLevel, FILLINGS, ABSURD_FILLINGS } from './content/jobs.js';
import { SPECIES, TRICKS, petStatus } from './content/animals.js';
import { pieTargets, PIE_POINTS } from './minigame-logic.js';
import { isClean } from './chat-filter.js';
import { VEHICLES, CAR_PAINTS } from './content/vehicles.js';
import { BUILDINGS } from './world-layout.js';
import { defaultNeeds, applyNeeds, needsStatus } from './needs.js';
import { ACTIVITIES, quizOfDay } from './activities.js';
import { PROPERTY_HANDLERS, expireRentals } from './authority-property.js';
import { BANK_HANDLERS } from './authority-bank.js';
import { CAREER_HANDLERS, careerOnPosition, defaultCareer } from './authority-careers.js';
import { BUSINESS_HANDLERS } from './authority-business.js';
import { BODY_HANDLERS } from './authority-body.js';
import { JUSTICE_HANDLERS, jailTick } from './authority-justice.js';
import { LEISURE_HANDLERS, defaultLeisure } from './authority-leisure.js';
import { CALENDAR_HANDLERS, defaultCalendar, tournamentSubmit } from './authority-calendar.js';
import { KARTING_HANDLERS, defaultKarting, kartOnPosition } from './authority-karting.js';
import { SPORTS_HANDLERS } from './authority-sports.js';
import { PREMIUM_HANDLERS } from './authority-premium.js';
import { ONLINE_HANDLERS } from './authority-online.js';
import { SAILING_HANDLERS } from './authority-sailing.js';
import { defaultFoot } from './sports.js';
import { defaultWing } from './wingfoil.js';
import { defaultDisc } from './courses.js';
import { MARKET_HANDLERS } from './authority-market.js';
import { COUR_HANDLERS } from './authority-cour.js';
import { ADMIN_HANDLERS, adminTopUp } from './authority-admin.js';
import { SOCIAL_HANDLERS } from './authority-social.js';
import { defaultCasino } from './casino.js';
import { defaultJustice } from './justice.js';
import { defaultBody, eatWeight } from './body.js';
import { deliverySpot, homeSize } from './property.js';

export const SHOP_BUILDING = { clothes: 'fringues', furniture: 'meubles', pets: 'animalerie', vehicles: 'garage' };
export const TRASH_SPOTS = [
  { id: 'poubelle-place', name: 'Poubelle de la Place', x: 22.5, z: 12 }, { id: 'poubelle-cafe', name: 'Poubelle du café', x: -38, z: -36 },
  { id: 'poubelle-plage', name: 'Poubelle de la plage', x: 6, z: 68 }, { id: 'poubelle-parc', name: 'Poubelle du parc', x: 6, z: -70 },
  { id: 'poubelle-mouettes', name: 'Poubelle des Mouettes', x: 90, z: 6 }, { id: 'poubelle-ferme', name: 'Poubelle de la ferme', x: -64, z: 7 },
];
const CUSTOMERS = ['Gérard', 'Mamie Turbo', 'Kevin', 'Mme Moustache', 'Le Maire', 'Bob le Pêcheur', 'Sandrine', 'Un pigeon (?)', 'Paulette', 'Jean-Mi'];
const SPRAY_RATE = 25; // points de feu éteints par seconde (lance de base)
const NEAR = { shop: 12, station: 9, stop: 6, fire: 17, tree: 5, counter: 7, stand: 12, basket: 5, secret: 3.5, board: 9 };

const r2 = (n) => Math.round(n);
const err = (error) => ({ ok: false, error });

export class Authority {
  constructor(content) { this.content = content; }
  setContent(content) { this.content = content; }

  newProfile({ id, name, appearance, now, age }) {
    const bad = validName(name);
    if (bad) throw new Error(bad);
    const body = defaultBody();
    if (typeof age === 'number' && age >= 16 && age <= 40) body.age = Math.floor(age); // âge de départ choisi
    return this.migrate({
      v: 1, id, name: name.trim().replace(/\s+/g, ' '), createdAt: now,
      coins: START_COINS, cash: START_CASH, xp: 0, rep: 0, body,
      appearance: sanitizeAppearance(appearance, this.content.items, new Set()),
    });
  }

  // Ajoute les champs manquants (profils anciens) : les mises à jour ne cassent pas les sauvegardes.
  migrate(p) {
    p.inventory ||= {};
    p.pets ||= [];
    p.activePet ??= null;
    p.vehicles ||= [];
    for (const v of p.vehicles) { v.damage ??= 0; v.fuel ??= VEHICLES[v.model]?.fuel ?? 0; v.km ??= 0; v.locked ??= true; }
    p.home ||= { size: 'studio', furniture: [] };
    p.home.place ||= 'studio';
    p.properties ||= [{ id: 'studio', how: 'rent', since: p.createdAt || 0 }];
    p.bills ||= { at: 0, acc: 0, paid: 0 };
    p.debt ??= 0;
    p.cash ??= 0;
    p.savings ??= 0;
    p.career ||= defaultCareer();
    p.body = { ...defaultBody(), ...(p.body || {}) };
    p.justice = { ...defaultJustice(), ...(p.justice || {}) };
    const lz = defaultLeisure();
    p.leisure = { ...(p.leisure || {}), range: { ...lz.range, ...(p.leisure?.range || {}) } };
    p.casino = { ...defaultCasino(), ...(p.casino || {}) };
    p.calendar = { ...defaultCalendar(), ...(p.calendar || {}) };
    p.karting = { ...defaultKarting(), ...(p.karting || {}) };
    { const df = defaultFoot(), f = p.sports?.foot || {}; p.sports = { ...(p.sports || {}), foot: { ...df, ...f, skills: { ...df.skills, ...(f.skills || {}) } }, wing: { ...defaultWing(), ...(p.sports?.wing || {}) } }; for (const k of ['course', 'velo', 'vtt', 'route', 'f1', 'ski', 'jetski']) p.sports[k] = { ...defaultDisc(), ...(p.sports[k] || {}) }; }
    p.jobs ||= {};
    for (const j of Object.keys(JOB_BY_ID)) p.jobs[j] ||= { xp: 0, missions: 0, upgrades: [] };
    p.minigames ||= {};
    p.secrets ||= [];
    p.stats ||= { earned: 0, spent: 0 };
    p.daily ||= { last: null, streak: 0 };
    p.activity ||= {};
    p.appearance = { ...DEFAULT_APPEARANCE, ...p.appearance };
    p.titles ||= [];
    p.needs ||= defaultNeeds();
    p.cooldowns ||= {};
    p.done ||= [];
    return p;
  }

  // Début de session (connexion) : les besoins ne baissent pas pendant qu'on est déconnecté.
  startSession(p, now) {
    p.needs = { ...(p.needs || defaultNeeds()), at: now };
    p.bills = { ...(p.bills || {}), at: now };
    expireRentals(p, now);
  }

  // Le joueur est-il dans (ou devant) un bâtiment ? (intérieur visitable ou porte à moins de 12 m)
  atBuilding(ctx, b, margin = 3) {
    const pos = ctx.pos;
    if (!pos) return false;
    if (Math.abs(pos.x - b.x) < b.w / 2 + margin && Math.abs(pos.z - b.z) < b.d / 2 + margin) return true;
    return this.near(ctx, b.door.x, b.door.z, NEAR.shop);
  }

  // Le joueur est-il dans une boutique qui vend cet objet ?
  inShopFor(ctx, it) {
    const shops = [it.shop, ...(it.also || [])];
    const list = BUILDINGS.filter((b) => shops.includes(b.shop));
    if (!list.length) return true;
    return list.some((b) => this.atBuilding(ctx, b));
  }

  owned(p) { return new Set(Object.keys(p.inventory).filter((k) => p.inventory[k] > 0)); }

  // Paiement : carte bancaire (compte) par défaut, ou en espèces (portefeuille).
  canPay(p, n, method) { return method === 'cash' ? (p.cash || 0) >= n : p.coins >= n; }
  charge(p, n, method) {
    n = Math.round(n);
    if (method === 'cash') { p.cash = Math.max(0, (p.cash || 0) - n); p.stats.spent += n; return -n; }
    return this.addCoins(p, -n);
  }

  addCoins(p, n) {
    n = Math.round(n);
    p.coins = Math.max(0, Math.min(MAX_COINS, p.coins + n));
    if (n > 0) p.stats.earned += n; else p.stats.spent -= n;
    return n;
  }

  addXp(p, n, jobId) {
    const before = levelFromXp(p.xp);
    p.xp += Math.round(n);
    let jobUp = null;
    if (jobId) {
      const j = p.jobs[jobId];
      const jb = jobLevel(j.xp);
      j.xp += Math.round(n);
      if (jobLevel(j.xp) > jb) jobUp = jobLevel(j.xp);
    }
    const after = levelFromXp(p.xp);
    return { levelUp: after > before ? after : null, jobUp };
  }

  near(ctx, x, z, r) { return ctx.pos && dist2d(ctx.pos.x, ctx.pos.z, x, z) <= r; }

  // ------------------------------------------------------------------ point d'entrée
  handle(ctx, type, payload = {}) {
    const fn = HANDLERS[type];
    if (!fn) return err('Action inconnue.');
    try {
      const expired = ctx.profile && expireRentals(ctx.profile, ctx.now);
      const away = ctx.profile && jailTick(ctx.profile, ctx.now);
      const res = fn.call(this, ctx, payload || {}) || err('Erreur.');
      if ((expired || away) && res.ok) res.changed = true;
      if (ctx.profile?.admin && res.ok) { adminTopUp(ctx.profile); res.changed = true; }
      return res;
    } catch (e) {
      ctx.log?.(`[authority] ${type}: ${e.stack || e}`);
      return err('Erreur interne.');
    }
  }

  // Appelé à chaque position validée (en ligne : par le serveur ; en solo : par le client).
  onPosition(ctx) {
    careerOnPosition(ctx);
    kartOnPosition(ctx);
    const s = ctx.session, pos = ctx.pos, now = ctx.now;
    const mg = s.mg;
    if (mg?.id === 'parcours' && !mg.finishAt && now - mg.startedAt > 3000) {
      const cps = MINIGAME_SPOTS.obstacle.checkpoints;
      const cp = cps[mg.next];
      if (cp && dist2d(pos.x, pos.z, cp.x, cp.z) <= 4.2 && Math.abs(pos.y - cp.y) <= 3.5) {
        mg.next++;
        mg.splits.push(now);
        if (mg.next >= cps.length) mg.finishAt = now;
      }
    }
    const m = s.mission;
    if (m?.job === 'firefighter' && m.fires) {
      for (const f of m.fires) if (!f.nearAt && dist2d(pos.x, pos.z, f.x, f.z) <= NEAR.fire) f.nearAt = now;
    }
    if (m?.job === 'delivery' && m.fragile && m.picked) {
      const g = groundHeight(pos.x, pos.z);
      if (pos.y > g + 0.7 && !m.inAir) { m.inAir = true; m.damage = Math.min(100, m.damage + 20); }
      else if (pos.y < g + 0.15) m.inAir = false;
    }
  }
}

// =====================================================================================================
const HANDLERS = {
  // ---------------------------------------------------------------- apparence & profil
  'avatar.update'(ctx, { appearance }) {
    const p = ctx.profile;
    p.appearance = sanitizeAppearance(appearance, this.content.items, this.owned(p));
    return { ok: true, changed: true, data: { appearance: p.appearance } };
  },

  'daily.claim'(ctx) {
    const p = ctx.profile;
    const today = todayKey(ctx.now);
    if (p.daily.last === today) return err('Bonus déjà récupéré aujourd\'hui. Reviens demain !');
    const yesterday = todayKey(ctx.now - 86400_000);
    p.daily.streak = p.daily.last === yesterday ? p.daily.streak + 1 : 1;
    p.daily.last = today;
    const coins = Math.min(DAILY.max, DAILY.base + DAILY.perStreak * (p.daily.streak - 1));
    this.addCoins(p, coins);
    return { ok: true, changed: true, data: { coins, streak: p.daily.streak } };
  },

  // ---------------------------------------------------------------- boutiques
  'shop.buy'(ctx, { itemId, pay }) {
    const p = ctx.profile;
    const it = this.content.items[itemId];
    if (!it || !it.available || !it.shop) return err('Cet article n\'est pas en vente.');
    if (!this.inShopFor(ctx, it)) return err('Il faut être dans la boutique.');
    const lv = levelFromXp(p.xp);
    if (it.level && lv < it.level) return err(`Niveau ${it.level} requis.`);
    if (it.rep && p.rep < it.rep) return err(`${it.rep} points de réputation requis.`);
    if (!this.canPay(p, it.price, pay)) return err(pay === 'cash' ? 'Pas assez d\'argent liquide (distributeur ou banque).' : 'Pas assez de PlayCoins.');
    const max = it.max ?? (it.slot ? 1 : it.consumable ? 99 : 20);
    if (it.pet) {
      if (p.pets.length >= MAX_PETS) return err(`Tu as déjà ${MAX_PETS} animaux. Confie-en un à la ferme pour en adopter un autre.`);
      const pet = { id: ctx.newId(), species: it.pet, name: SPECIES[it.pet].name, food: 80, fedAt: ctx.now, joy: 80, joyAt: ctx.now, trainings: 0, tricks: [], collar: '#ff5a5f', petAt: 0 };
      p.pets.push(pet);
      if (!p.activePet) p.activePet = pet.id;
      this.charge(p, it.price, pay);
      return { ok: true, changed: true, data: { pet } };
    }
    if (it.vehicle) {
      if (p.vehicles.some((v) => v.model === it.vehicle && !v.rentUntil)) return err('Tu possèdes déjà ce véhicule.');
      if (p.vehicles.filter((v) => !v.rentUntil).length >= 8) return err('Ton garage est plein (8 véhicules).');
      const shopB = BUILDINGS.find((b) => b.shop === it.shop);
      const v = { id: ctx.newId(), model: it.vehicle, color: it.color || '#e63946', damage: 0, fuel: VEHICLES[it.vehicle]?.fuel ?? 0, km: 0, locked: true, park: shopB ? deliverySpot(shopB, p.vehicles.length) : null };
      p.vehicles.push(v);
      this.charge(p, it.price, pay);
      return { ok: true, changed: true, data: { vehicle: v } };
    }
    if (it.special === 'home-upgrade') {
      if (p.home.size === 'appart') return err('Ton logement est déjà agrandi.');
      if (p.home.place !== 'studio') return err('L\'agrandissement concerne le studio de la Résidence Les Mouettes.');
      p.home.size = 'appart';
      this.charge(p, it.price, pay);
      return { ok: true, changed: true, data: {} };
    }
    if ((p.inventory[itemId] || 0) >= max) return err('Tu en as déjà assez !');
    p.inventory[itemId] = (p.inventory[itemId] || 0) + 1;
    this.charge(p, it.price, pay);
    return { ok: true, changed: true, data: { count: p.inventory[itemId] } };
  },

  // Panier (supermarché) : plusieurs articles payés d'un coup à la caisse.
  'shop.buyMany'(ctx, { items, pay }) {
    const p = ctx.profile;
    if (!Array.isArray(items) || !items.length || items.length > 30) return err('Panier invalide.');
    let total = 0;
    const lines = [];
    for (const { id, n } of items) {
      const it = this.content.items[id], k = n | 0;
      if (!it || !it.available || !it.shop || !it.consumable || k < 1 || k > 20) return err('Article invalide dans le panier.');
      if (!this.inShopFor(ctx, it)) return err('Il faut être à la caisse du magasin.');
      if ((p.inventory[id] || 0) + k > (it.max ?? 99)) return err(`Trop de « ${it.name} » !`);
      total += it.price * k;
      lines.push([id, k]);
    }
    if (!this.canPay(p, total, pay)) return err(pay === 'cash' ? `Pas assez de liquide (${total} PC).` : `Pas assez de PlayCoins (${total} PC).`);
    for (const [id, k] of lines) p.inventory[id] = (p.inventory[id] || 0) + k;
    this.charge(p, total, pay);
    return { ok: true, changed: true, data: { total } };
  },

  'shop.sell'(ctx, { itemId }) {
    const p = ctx.profile;
    const it = this.content.items[itemId];
    if (!it || it.consumable || it.pet || it.vehicle || it.special) return err('Cet objet ne se revend pas.');
    if (!this.inShopFor(ctx, it)) return err('Il faut être dans la boutique.');
    const have = p.inventory[itemId] || 0;
    const placed = p.home.furniture.filter((f) => f.i === itemId).length;
    if (have - placed <= 0) return err(placed ? 'Retire d\'abord ce meuble de ton logement.' : 'Tu ne possèdes pas cet objet.');
    p.inventory[itemId] = have - 1;
    for (const slot of ['hat', 'glasses', 'top', 'bottom', 'back']) if (p.appearance[slot] === itemId && p.inventory[itemId] === 0) p.appearance[slot] = DEFAULT_APPEARANCE[slot];
    const gain = Math.floor(it.price * 0.4);
    this.addCoins(p, gain);
    return { ok: true, changed: true, data: { gain } };
  },

  // ---------------------------------------------------------------- métiers
  'job.start'(ctx, { jobId, missionId }) {
    const p = ctx.profile;
    const job = JOB_BY_ID[jobId];
    if (!job) return err('Métier inconnu.');
    const mt = job.missions.find((m) => m.id === missionId);
    if (!mt) return err('Mission inconnue.');
    const lv = jobLevel(p.jobs[jobId].xp);
    if (lv < mt.level) return err(`Niveau ${mt.level} de ${job.name} requis.`);
    const st = job.station === 'burger' ? POI.foodCounter : BUILDING_BY_ID[job.station].door;
    if (!this.near(ctx, st.x, st.z, job.station === 'burger' ? NEAR.counter : NEAR.station)) return err('Va au poste de travail pour prendre une mission.');
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    const rand = mulberry32(seed);
    const ups = p.jobs[jobId].upgrades;
    const m = { id: ctx.newId(), job: jobId, type: mt.id, seed, startedAt: ctx.now, level: lv };
    if (jobId === 'delivery') {
      const far = lv >= 3 ? ADDRESSES : ADDRESSES.filter((a) => !['ponton', 'atelier', 'fermette', 'grange'].includes(a.id));
      m.stops = shuffle(rand, far).slice(0, mt.stops).map((a) => ({ id: a.id, name: a.name, x: a.x, z: a.z, done: false }));
      m.picked = false;
      m.damage = 0;
      m.fragile = !!mt.fragile;
      if (mt.timed) {
        const depot = POI.depot;
        const d = dist2d(depot.x, depot.z, m.stops[0].x, m.stops[0].z);
        m.limit = Math.round((d / 6.2 + 12) * (ups.includes('gps') ? 1.25 : 1));
      }
    } else if (jobId === 'firefighter') {
      if (mt.cat) {
        const t = pick(rand, CAT_TREES);
        m.tree = { id: t.id, x: t.x, z: t.z };
      } else if (mt.trash) {
        const t = pick(rand, TRASH_SPOTS);
        m.fires = [{ i: 0, id: t.id, name: t.name, x: t.x, y: 0.8, z: t.z, hp: mt.hp, out: false }];
      } else {
        m.fires = shuffle(rand, FIRE_SPOTS).slice(0, mt.fires).map((f, i) => ({ i, id: f.id, name: f.name, x: f.x, y: f.y, z: f.z, hp: mt.hp, out: false }));
      }
      m.rate = SPRAY_RATE * (ups.includes('lance-turbo') ? 1.4 : 1);
    } else if (jobId === 'cook') {
      const pool = mt.absurd ? [...FILLINGS, ...ABSURD_FILLINGS] : FILLINGS;
      m.orders = [];
      for (let i = 0; i < mt.orders; i++) {
        const n = randInt(rand, mt.fillings[0], mt.fillings[1]);
        const fill = [];
        for (let k = 0; k < n; k++) fill.push(pick(rand, pool));
        if (mt.absurd && !fill.some((f) => ABSURD_FILLINGS.includes(f))) fill[n - 1] = pick(rand, ABSURD_FILLINGS);
        m.orders.push({ customer: pick(rand, CUSTOMERS), recipe: ['pain-bas', ...fill, 'pain-haut'] });
      }
      m.current = 0;
      m.orderStart = ctx.now;
      m.patience = mt.patience * (ups.includes('musique') ? 1.25 : 1);
      m.results = [];
      m.earned = 0;
    }
    ctx.session.mission = m;
    return { ok: true, data: { mission: publicMission(m) } };
  },

  'job.cancel'(ctx) {
    ctx.session.mission = null;
    return { ok: true, data: {} };
  },

  'job.step'(ctx, { missionId, action, ...a }) {
    const p = ctx.profile, m = ctx.session.mission, now = ctx.now;
    if (!m || m.id !== missionId) return err('Aucune mission en cours.');
    const job = JOB_BY_ID[m.job];
    const mt = job.missions.find((x) => x.id === m.type);
    const ups = p.jobs[m.job].upgrades;
    const levelMult = 1 + 0.1 * (m.level - 1);

    // --- Livreur
    if (m.job === 'delivery') {
      if (action === 'pickup') {
        if (m.picked) return err('Colis déjà récupéré.');
        if (!this.near(ctx, POI.depot.x, POI.depot.z, NEAR.station)) return err('Le colis est au dépôt Colis Express.');
        m.picked = true; m.pickedAt = now;
        return { ok: true, data: { mission: publicMission(m) } };
      }
      if (action === 'deliver') {
        if (!m.picked) return err('Récupère d\'abord le colis au dépôt.');
        const stop = m.stops.find((s) => s.id === a.stop && !s.done);
        if (!stop) return err('Cette adresse n\'est pas sur ta liste.');
        if (!this.near(ctx, stop.x, stop.z, NEAR.stop)) return err('Tu n\'es pas devant la bonne porte.');
        stop.done = true;
        if (m.stops.some((s) => !s.done)) return { ok: true, data: { mission: publicMission(m) } };
        // terminé
        let pay = mt.pay * levelMult;
        const notes = [];
        if (m.limit) {
          const secs = (now - m.pickedAt) / 1000;
          if (secs <= m.limit) { pay *= 1.6; notes.push('Livré à temps : bonus express !'); } else { pay *= 0.7; notes.push('En retard... le client a noté "bof".'); }
        }
        if (m.type === 'tournee' && ups.includes('sac-xxl')) pay *= 1.25;
        if (m.fragile) { pay *= Math.max(0.2, 1 - m.damage / 100); notes.push(m.damage ? `Colis abîmé à ${m.damage} %.` : 'Pas un œuf cassé. Respect.'); }
        return this.completeMission(ctx, m, pay, mt.xp, notes, { deliveries: m.stops.length });
      }
      return err('Action inconnue.');
    }

    // --- Pompier
    if (m.job === 'firefighter') {
      if (action === 'rescue' && m.tree) {
        if (!this.near(ctx, m.tree.x, m.tree.z, NEAR.tree)) return err('Le chat est dans un autre arbre.');
        if (now - m.startedAt < 2500) return err('Doucement...');
        return this.completeMission(ctx, m, mt.pay * levelMult * (ups.includes('casque-dore') ? 1.2 : 1), mt.xp, ['Le chat te remercie à sa façon : il t\'ignore.'], { rescues: 1 });
      }
      if (action === 'extinguish' && m.fires) {
        const f = m.fires[a.fire];
        if (!f || f.out) return err('Ce feu est déjà éteint.');
        if (!this.near(ctx, f.x, f.z, NEAR.fire)) return err('Trop loin du feu.');
        const need = (f.hp / m.rate) * 1000 * 0.75;
        if (!f.nearAt || now - f.nearAt < need) return err('Le feu n\'est pas encore éteint.');
        f.out = true;
        if (m.fires.some((x) => !x.out)) return { ok: true, data: { mission: publicMission(m) } };
        const secs = (now - m.startedAt) / 1000;
        const fast = secs < 40 + m.fires.length * 25;
        const pay = mt.pay * levelMult * (fast ? 1.25 : 1) * (ups.includes('casque-dore') ? 1.2 : 1);
        return this.completeMission(ctx, m, pay, mt.xp, [fast ? 'Intervention éclair : bonus de rapidité !' : 'Feu maîtrisé. Les voisins applaudissent (un peu).'], { fires: m.fires.length });
      }
      return err('Action inconnue.');
    }

    // --- Cuisinier
    if (m.job === 'cook') {
      if (!this.near(ctx, POI.foodCounter.x, POI.foodCounter.z, NEAR.counter)) return err('Reste derrière le comptoir du camion !');
      const o = m.orders[m.current];
      if (!o || a.order !== m.current) return err('Commande inconnue.');
      const elapsed = (now - m.orderStart) / 1000;
      let res;
      if (action === 'timeout') {
        if (elapsed < m.patience - 1) return err('Le client attend encore.');
        res = { ok: false, reason: 'parti', pay: 0 };
      } else if (action === 'serve') {
        const stack = Array.isArray(a.stack) ? a.stack.slice(0, 12) : [];
        const exact = stack.length === o.recipe.length && stack.every((x, i) => x === o.recipe[i]);
        if (elapsed > m.patience + 3) res = { ok: false, reason: 'parti', pay: 0 };
        else if (!exact) res = { ok: false, reason: 'faux', pay: 0 };
        else {
          const tip = 0.5 * Math.max(0, 1 - elapsed / m.patience) * (ups.includes('spatule-doree') ? 1.2 : 1);
          const pay = mt.payPerOrder * levelMult * (1 + tip) * (ups.includes('menu-xl') ? 1.3 : 1);
          res = { ok: true, pay: r2(pay), tip: Math.round(tip * 100) };
        }
      } else return err('Action inconnue.');
      m.results.push(res);
      m.earned += res.pay;
      m.current++;
      m.orderStart = now;
      if (m.current < m.orders.length) return { ok: true, data: { result: res, mission: publicMission(m) } };
      const good = m.results.filter((x) => x.ok).length;
      const notes = [`${good}/${m.orders.length} commandes parfaites.`];
      const done = this.completeMission(ctx, m, m.earned, mt.xpPerOrder * Math.max(1, good), notes, { burgers: good });
      done.data.result = res;
      return done;
    }
    return err('Action inconnue.');
  },

  'job.upgrade'(ctx, { jobId, upgradeId }) {
    const p = ctx.profile, job = JOB_BY_ID[jobId];
    const up = job?.upgrades.find((u) => u.id === upgradeId);
    if (!up) return err('Amélioration inconnue.');
    const st = job.station === 'burger' ? POI.foodCounter : BUILDING_BY_ID[job.station].door;
    if (!this.near(ctx, st.x, st.z, NEAR.station)) return err('Va au poste de travail.');
    const j = p.jobs[jobId];
    if (j.upgrades.includes(upgradeId)) return err('Déjà acheté.');
    if (jobLevel(j.xp) < up.level) return err(`Niveau ${up.level} de ${job.name} requis.`);
    if (p.coins < up.price) return err('Pas assez de PlayCoins.');
    this.addCoins(p, -up.price);
    j.upgrades.push(upgradeId);
    return { ok: true, changed: true, data: {} };
  },

  // ---------------------------------------------------------------- mini-jeux
  'mg.start'(ctx, { id }) {
    const def = this.content.minigames[id];
    if (!def) return err('Mini-jeu indisponible.');
    const spot = MINIGAME_SPOTS[def.spot];
    if (!this.near(ctx, spot.x, spot.z, NEAR.stand)) return err('Va au stand pour jouer.');
    const seed = randInt(ctx.rand, 1, 2 ** 31 - 2);
    ctx.session.mg = { id, seed, startedAt: ctx.now, score: 0, hits: [], delivered: [], carrying: null, lastDeliver: 0, next: 0, splits: [], finishAt: null };
    return { ok: true, data: { seed, countdown: 3 } };
  },

  'mg.event'(ctx, { kind, ...a }) {
    const mg = ctx.session.mg;
    if (!mg) return err('Aucune partie en cours.');
    const def = this.content.minigames[mg.id];
    const t = (ctx.now - mg.startedAt) / 1000 - 3; // temps de jeu (après le compte à rebours)
    if (t < -0.5) return err('La partie n\'a pas commencé.');
    if (def.duration && t > def.duration + 1.5) return err('La partie est terminée.');
    if (mg.id === 'tartes' && kind === 'hit') {
      const targets = mg.targets ||= pieTargets(mg.seed, def.duration, def.targets);
      const tg = targets[a.target];
      if (!tg || mg.hits.includes(tg.i)) return err('Cible invalide.');
      if (t < tg.t - 0.6 || t > tg.t + tg.d + 1.2) return err('Cible absente à ce moment-là.');
      mg.hits.push(tg.i);
      mg.score += PIE_POINTS[tg.type];
      return { ok: true, data: { score: mg.score, points: PIE_POINTS[tg.type] } };
    }
    if (mg.id === 'poulets') {
      const pen = MINIGAME_SPOTS.chickenRace.pen;
      if (kind === 'grab') {
        const i = a.chicken | 0;
        if (i < 0 || i >= def.chickens || mg.delivered.includes(i)) return err('Poulet invalide.');
        if (mg.carrying !== null) return err('Tu portes déjà un poulet.');
        if (!ctx.pos || Math.abs(ctx.pos.x - pen.x) > pen.w / 2 + 3 || Math.abs(ctx.pos.z - pen.z) > pen.d / 2 + 3) return err('Reste dans l\'enclos.');
        mg.carrying = i;
        return { ok: true, data: {} };
      }
      if (kind === 'deliver') {
        if (mg.carrying === null) return err('Tu ne portes pas de poulet.');
        const B = MINIGAME_SPOTS.chickenRace.basket;
        if (!this.near(ctx, B.x, B.z, NEAR.basket)) return err('Le panier est au centre de l\'enclos.');
        if (ctx.now - mg.lastDeliver < 900) return err('Trop rapide.');
        mg.delivered.push(mg.carrying);
        mg.carrying = null;
        mg.lastDeliver = ctx.now;
        mg.score = mg.delivered.length;
        return { ok: true, data: { score: mg.score } };
      }
      if (kind === 'drop') { mg.carrying = null; return { ok: true, data: {} }; }
    }
    return err('Action inconnue.');
  },

  'mg.finish'(ctx) {
    const p = ctx.profile, mg = ctx.session.mg;
    if (!mg) return err('Aucune partie en cours.');
    const def = this.content.minigames[mg.id];
    const t = (ctx.now - mg.startedAt) / 1000 - 3;
    let score;
    if (def.kind === 'time') {
      if (!mg.finishAt) return err('Tu n\'as pas franchi tous les anneaux.');
      score = Math.round(((mg.finishAt - mg.startedAt) / 1000 - 3) * 100) / 100;
      if (score < def.minTime) { ctx.session.mg = null; return err('Temps impossible : partie refusée.'); }
    } else {
      const allDone = mg.id === 'poulets' && mg.delivered.length >= def.chickens;
      if (t < def.duration - 1.5 && !allDone) return err('La partie n\'est pas finie.');
      score = mg.score;
    }
    ctx.session.mg = null;
    const factor = activityFactor(p, `mg:${mg.id}`, ctx.now);
    recordActivity(p, `mg:${mg.id}`, ctx.now);
    const rw = minigameReward(def, score);
    const coins = this.addCoins(p, rw.coins * factor);
    const lv = this.addXp(p, rw.xp * factor);
    const st = (p.minigames[mg.id] ||= { best: null, plays: 0 });
    st.plays++;
    const better = st.best === null || (def.kind === 'time' ? score < st.best : score > st.best);
    if (better) st.best = score;
    let rank = null;
    if (ctx.leaderboard) rank = ctx.leaderboard.submit(mg.id, p, score, def.kind === 'time');
    if (rank === 1) p.rep += 5;
    const tournament = tournamentSubmit(ctx, mg.id, score, def.kind === 'time');
    return { ok: true, changed: true, data: { score, coins, xp: Math.round(rw.xp * factor), medal: rw.medal, best: st.best, record: better, rank, factor, tournament, ...lv } };
  },

  'mg.cancel'(ctx) { ctx.session.mg = null; return { ok: true, data: {} }; },

  'mg.board'(ctx, { id }) {
    if ((!this.content.minigames[id] && !['tir', 'kart', 'cour-cachette', 'cour-loup', 'cour-cherche'].includes(String(id).split(':')[0])) || !ctx.leaderboard) return { ok: true, data: { top: [] } };
    return { ok: true, data: { top: ctx.leaderboard.top(id, 10) } };
  },

  // ---------------------------------------------------------------- objets secrets
  'secret.collect'(ctx, { id }) {
    const p = ctx.profile, s = SECRET_BY_ID[id];
    if (!s) return err('Rien ici.');
    if (p.secrets.includes(id)) return err('Déjà trouvé !');
    if (!this.near(ctx, s.x, s.z, NEAR.secret) || Math.abs((ctx.pos.y || 0) - s.y) > 3) return err('Trop loin.');
    p.secrets.push(id);
    let coins = this.addCoins(p, 60);
    p.rep += 2;
    const lv = this.addXp(p, 15);
    let all = false;
    if (p.secrets.length === SECRETS.length) { coins += this.addCoins(p, 600); p.rep += 30; p.titles.push('Chasseur de canards'); all = true; }
    return { ok: true, changed: true, data: { coins, found: p.secrets.length, total: SECRETS.length, all, ...lv } };
  },

  // ---------------------------------------------------------------- animaux de compagnie
  // ---------------------------------------------------------------- activités dans les bâtiments
  'activity.do'(ctx, { kind, buildingId, answer }) {
    const p = ctx.profile, a = ACTIVITIES[kind], b = BUILDING_BY_ID[buildingId];
    if (!a || !b) return err('Activité inconnue.');
    if (a.where && !a.where.includes(b.interior)) return err('Pas ici.');
    if (!this.atBuilding(ctx, b, 1)) return err('Il faut être dans le bâtiment.');
    const key = `${kind}`;
    if (a.once && p.done.includes(`${kind}:${b.id}`)) return err('Déjà fait !');
    const wait = (p.cooldowns[key] || 0) + (a.cooldown || 0) - ctx.now;
    if (wait > 0) return err(`Encore ${Math.ceil(wait / 1000)} s avant de recommencer.`);
    if (a.cost && p.coins < a.cost) return err('Pas assez de PlayCoins.');
    const data = { kind };
    if (kind === 'quiz') {
      const qz = quizOfDay(ctx.now);
      data.correct = answer === qz.a;
      data.answer = qz.c[qz.a];
      p.cooldowns[key] = ctx.now;
      if (!data.correct) return { ok: true, changed: true, data };
    }
    if (a.cost) this.addCoins(p, -a.cost);
    p.cooldowns[key] = ctx.now;
    if (a.once) p.done.push(`${kind}:${b.id}`);
    if (a.needs) applyNeeds(p.needs, ctx.now, a.needs);
    if (a.xp) data.xp = a.xp, this.addXp(p, a.xp);
    let coins = a.coins || 0;
    if (a.jackpot && ctx.rand() < a.jackpot) { coins += a.jackpotCoins; data.jackpot = true; }
    if (kind === 'bowling') { data.pins = Math.min(10, Math.floor(ctx.rand() * 11 + ctx.rand() * 3)); if (data.pins === 10) { coins += 5; data.strike = true; } }
    if (a.prize && ctx.rand() < a.prizeChance) { p.inventory[a.prize] = (p.inventory[a.prize] || 0) + 1; data.prize = a.prize; }
    if (a.title && !p.titles.includes(a.title)) { p.titles.push(a.title); data.title = a.title; }
    if (coins) { this.addCoins(p, coins); data.coins = coins; }
    data.needs = needsStatus(p.needs, ctx.now);
    return { ok: true, changed: true, data };
  },

  // ---------------------------------------------------------------- besoins (manger, boire...)
  'food.eat'(ctx, { itemId }) {
    const p = ctx.profile, it = this.content.items[itemId];
    if (!it?.food) return err('Ça ne se mange pas !');
    if (!(p.inventory[itemId] > 0)) return err('Tu n\'en as plus.');
    const st = needsStatus(p.needs, ctx.now);
    if (st.faim >= 98 && it.food.faim > 10) return err('Tu n\'as vraiment plus faim.');
    p.inventory[itemId]--;
    eatWeight(p.body, st.faim, it.food);
    applyNeeds(p.needs, ctx.now, it.food);
    return { ok: true, changed: true, data: { needs: needsStatus(p.needs, ctx.now), weight: p.body.weight } };
  },

  'pet.feed'(ctx, { petId }) {
    const p = ctx.profile, pet = p.pets.find((x) => x.id === petId);
    if (!pet) return err('Animal introuvable.');
    if (!(p.inventory.croquettes > 0)) return err('Plus de croquettes ! (Animalerie Poil-Poil)');
    const st = petStatus(pet, ctx.now);
    if (st.food >= 95) return err(`${pet.name} n'a plus faim.`);
    p.inventory.croquettes--;
    pet.food = Math.min(100, st.food + 40); pet.fedAt = ctx.now;
    pet.joy = Math.min(100, st.joy + 5); pet.joyAt = ctx.now;
    return { ok: true, changed: true, data: { pet } };
  },

  'pet.cuddle'(ctx, { petId }) {
    const p = ctx.profile, pet = p.pets.find((x) => x.id === petId);
    if (!pet) return err('Animal introuvable.');
    if (ctx.now - (pet.petAt || 0) < 15000) return err(`${pet.name} a déjà eu sa dose de câlins.`);
    const st = petStatus(pet, ctx.now);
    pet.joy = Math.min(100, st.joy + 15); pet.joyAt = ctx.now; pet.petAt = ctx.now;
    return { ok: true, changed: true, data: { pet } };
  },

  'pet.train'(ctx, { petId }) {
    const p = ctx.profile, pet = p.pets.find((x) => x.id === petId);
    if (!pet) return err('Animal introuvable.');
    if (!(p.inventory.friandise > 0)) return err('Il faut des friandises pour le dressage.');
    const st = petStatus(pet, ctx.now);
    if (st.joy < 20 || st.food < 20) return err(`${pet.name} est trop ${st.food < 20 ? 'affamé' : 'triste'} pour apprendre.`);
    p.inventory.friandise--;
    pet.trainings++;
    let learned = null;
    for (const t of TRICKS) if (pet.trainings >= t.trainings && !pet.tricks.includes(t.id)) { pet.tricks.push(t.id); learned = t; break; }
    if (learned) { this.addXp(p, 10); p.rep += 1; }
    return { ok: true, changed: true, data: { pet, learned } };
  },

  'pet.rename'(ctx, { petId, name }) {
    const pet = ctx.profile.pets.find((x) => x.id === petId);
    if (!pet) return err('Animal introuvable.');
    if (typeof name !== 'string' || !/^[A-Za-zÀ-ÖØ-öø-ÿ0-9 '-]{2,14}$/.test(name.trim()) || !isClean(name)) return err('Nom invalide (2 à 14 lettres).');
    pet.name = name.trim();
    return { ok: true, changed: true, data: { pet } };
  },

  'pet.collar'(ctx, { petId, color }) {
    const pet = ctx.profile.pets.find((x) => x.id === petId);
    if (!pet || !COLORS.includes(color)) return err('Impossible.');
    pet.collar = color;
    return { ok: true, changed: true, data: { pet } };
  },

  'pet.active'(ctx, { petId }) {
    const p = ctx.profile;
    if (petId !== null && !p.pets.some((x) => x.id === petId)) return err('Animal introuvable.');
    p.activePet = petId;
    return { ok: true, changed: true, data: {} };
  },

  'pet.rehome'(ctx, { petId }) {
    const p = ctx.profile;
    const i = p.pets.findIndex((x) => x.id === petId);
    if (i < 0) return err('Animal introuvable.');
    const [pet] = p.pets.splice(i, 1);
    if (p.activePet === petId) p.activePet = p.pets[0]?.id ?? null;
    return { ok: true, changed: true, data: { name: pet.name } };
  },

  // ---------------------------------------------------------------- logement
  'home.place'(ctx, { itemId, x, z, r }) {
    const p = ctx.profile, it = this.content.items[itemId];
    if (!it?.furniture) return err('Ce n\'est pas un meuble.');
    const placed = p.home.furniture.filter((f) => f.i === itemId).length;
    if ((p.inventory[itemId] || 0) <= placed) return err('Tu n\'as plus ce meuble en stock.');
    if (p.home.furniture.length >= 60) return err('Ton logement est plein !');
    const pos = clampHome(p, x, z);
    if (!pos) return err('Position invalide.');
    p.home.furniture.push({ i: itemId, x: pos.x, z: pos.z, r: (r | 0) & 3 });
    return { ok: true, changed: true, data: { index: p.home.furniture.length - 1 } };
  },

  'home.move'(ctx, { index, x, z, r }) {
    const f = ctx.profile.home.furniture[index];
    if (!f) return err('Meuble introuvable.');
    const pos = clampHome(ctx.profile, x, z);
    if (!pos) return err('Position invalide.');
    Object.assign(f, { x: pos.x, z: pos.z, r: (r | 0) & 3 });
    return { ok: true, changed: true, data: {} };
  },

  'home.remove'(ctx, { index }) {
    const list = ctx.profile.home.furniture;
    if (!list[index]) return err('Meuble introuvable.');
    list.splice(index, 1);
    return { ok: true, changed: true, data: {} };
  },

  // ---------------------------------------------------------------- véhicules
  'vehicle.paint'(ctx, { vehicleId, color }) {
    const p = ctx.profile, v = p.vehicles.find((x) => x.id === vehicleId);
    if (!v) return err('Véhicule introuvable.');
    if (!COLORS.includes(color) && !CAR_PAINTS.includes(color)) return err('Couleur indisponible.');
    if (!(p.inventory.peinture > 0)) return err('Achète d\'abord une peinture au garage.');
    p.inventory.peinture--;
    v.color = color;
    return { ok: true, changed: true, data: {} };
  },

  // État d'un véhicule possédé (après avoir roulé) : les dégâts ne peuvent qu'augmenter et le carburant
  // que baisser (réparer et faire le plein se paient au garage / à la station-service).
  'vehicle.state'(ctx, { vehicleId, damage, fuel, km }) {
    const v = ctx.profile.vehicles.find((x) => x.id === vehicleId);
    if (!v) return err('Véhicule introuvable.');
    const spec = VEHICLES[v.model];
    if (typeof damage !== 'number' || typeof fuel !== 'number' || !Number.isFinite(damage) || !Number.isFinite(fuel)) return err('État invalide.');
    v.damage = Math.round(Math.max(v.damage || 0, Math.min(1, damage)) * 1000) / 1000;
    v.fuel = Math.round(Math.max(0, Math.min(v.fuel ?? spec?.fuel ?? 0, fuel)) * 10) / 10;
    // compteur kilométrique : ne fait qu'augmenter, et pas plus vite qu'une voiture
    if (typeof km === 'number' && Number.isFinite(km)) v.km = Math.round(Math.max(v.km || 0, Math.min(km, (v.km || 0) + 5)) * 10) / 10;
    return { ok: true, changed: true, data: { damage: v.damage, fuel: v.fuel, km: v.km } };
  },

  // ---------------------------------------------------------------- événements publics
  'event.trigger'(ctx, { eventId }) {
    const p = ctx.profile, ev = this.content.events[eventId];
    if (!ev || !ctx.events) return err('Événement indisponible.');
    if (!this.near(ctx, POI.eventBoard.x, POI.eventBoard.z, NEAR.board)) return err('Le tableau des événements est sur la Grande Place.');
    if (p.coins < ev.triggerPrice) return err('Pas assez de PlayCoins.');
    const why = ctx.events.canStart(eventId, ctx.now);
    if (why) return err(why);
    this.addCoins(p, -ev.triggerPrice);
    p.rep += 3; // organiser un événement rend populaire
    ctx.events.start(eventId, ctx.now, p.name);
    return { ok: true, changed: true, data: {} };
  },

  'event.action'(ctx, payload) {
    if (!ctx.events) return err('Aucun événement.');
    const res = ctx.events.action(ctx.profile, ctx.pos, ctx.now, payload);
    if (!res.ok) return res;
    const p = ctx.profile;
    if (res.coins) this.addCoins(p, res.coins);
    if (res.rep) p.rep += res.rep;
    return { ok: true, changed: !!(res.coins || res.rep), data: res };
  },
};

Object.assign(HANDLERS, PROPERTY_HANDLERS, BANK_HANDLERS, CAREER_HANDLERS, BUSINESS_HANDLERS, BODY_HANDLERS, JUSTICE_HANDLERS, LEISURE_HANDLERS, CALENDAR_HANDLERS, KARTING_HANDLERS, SPORTS_HANDLERS, PREMIUM_HANDLERS, ONLINE_HANDLERS, SAILING_HANDLERS, MARKET_HANDLERS, COUR_HANDLERS, ADMIN_HANDLERS, SOCIAL_HANDLERS);
// Liste des entreprises de joueurs où investir (en ligne).
HANDLERS['invest.list'] = (ctx) => ({ ok: true, changed: false, data: ctx.companies ? ctx.companies.list(ctx.now) : [] });

// Termine une mission : paie (avec rendements décroissants), XP, statistiques.
Authority.prototype.completeMission = function completeMission(ctx, m, pay, xp, notes, stats) {
  const p = ctx.profile;
  const factor = activityFactor(p, `job:${m.job}`, ctx.now);
  recordActivity(p, `job:${m.job}`, ctx.now);
  const coins = this.addCoins(p, pay * factor);
  const lv = this.addXp(p, xp * factor, m.job);
  p.jobs[m.job].missions++;
  for (const [k, v] of Object.entries(stats || {})) p.stats[k] = (p.stats[k] || 0) + v;
  ctx.session.mission = null;
  if (factor < 1) notes.push(`Tu as beaucoup travaillé cette heure-ci : paie à ${Math.round(factor * 100)} %.`);
  return { ok: true, changed: true, data: { done: true, coins, xp: Math.round(xp * factor), notes, ...lv } };
};

function clampHome(p, x, z) {
  const S = homeSize(p);
  if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const hx = S.w / 2 - 0.6, hz = S.d / 2 - 0.6;
  if (Math.abs(x) > hx + 0.01 || Math.abs(z) > hz + 0.01) return null;
  return { x: Math.round(x * 4) / 4, z: Math.round(z * 4) / 4 };
}

// Ce que le client a le droit de savoir d'une mission (on ne lui envoie pas les données internes).
export function publicMission(m) {
  const o = { id: m.id, job: m.job, type: m.type, startedAt: m.startedAt, seed: m.seed };
  if (m.job === 'delivery') Object.assign(o, { stops: m.stops, picked: m.picked, limit: m.limit, fragile: m.fragile, damage: m.damage, pickedAt: m.pickedAt });
  if (m.job === 'firefighter') Object.assign(o, { tree: m.tree, fires: m.fires?.map((f) => ({ i: f.i, name: f.name, x: f.x, y: f.y, z: f.z, hp: f.hp, out: f.out })), rate: m.rate });
  if (m.job === 'cook') Object.assign(o, { orders: m.orders, current: m.current, patience: m.patience, results: m.results, earned: m.earned });
  return o;
}

export { HOME_INTERIOR };
