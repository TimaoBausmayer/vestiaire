import { h } from '../ui/dom.js';
import { bodyEffects, attractiveness, INJURIES, GYM_PASSES, MACHINES, MACHINE_MAX_MIN, tapsPerPushup, CLINIC, HAIR_PRICES } from '../../shared/body.js';
import { needsStatus } from '../../shared/needs.js';
import { HAIR_STYLES, HAIR_COLORS } from '../../shared/appearance.js';

// CORPS (côté client) : barre de santé, blessures (chutes, accidents), KO → réveil à l'hôpital,
// pompes au clavier, machines de la salle de sport (qui tournent toutes seules), coiffeur, clinique,
// appli Santé (poids, muscles, âge, attirance).

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const HAIR_LABELS = { court: 'Court', meche: 'Mèche', herisse: 'Hérissé', long: 'Long', chignon: 'Chignon', afro: 'Afro', crete: 'Crête', couettes: 'Couettes', chauve: 'Chauve' };

export class Body {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.air = null;     // suivi des chutes
    this.ko = false;
    this.bar = h('div.need.sante', { title: 'Santé' }, h('span', '❤️'), h('div.nb', this.fill = h('div')));
    game.life?.el.prepend(this.bar);
    game.on('vehicle.crash', (sp) => this.hurt('crash', sp));
  }

  get b() { return this.game.profile?.body; }

  async hurt(cause, value) {
    const g = this.game;
    try {
      const r = await g.net.request('body.hurt', { cause, value });
      if (!r.kind) return;
      const inj = INJURIES[r.kind];
      g.sfx('bump');
      g.cam.shake = 0.6;
      g.labels.bubble(g.avatar.root, { bosse: 'Aïe ! Ma tête !', entorse: 'Ouille, ma cheville !', fracture: 'AAAH ! Mon bras !', commotion: 'Je vois des pigeons qui tournent...' }[r.kind], 3000, 'player');
      g.ui.toast(`🩹 ${inj.name} ! Santé ${Math.round(r.health)}. Repos (${inj.minutes} min de jeu) ou soins à l'hôpital (~${inj.care} PC).`, 'bad', 5500);
      if (r.ko) this.knockOut();
    } catch { /* hors ligne */ }
  }

  // Évanouissement : on se réveille à l'hôpital (soins facturés).
  async knockOut() {
    const g = this.game;
    if (this.ko) return;
    this.ko = true;
    if (g.vehicles?.driving) g.vehicles.exit(true);
    const fade = h('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: '0', transition: 'opacity 1s', zIndex: '45', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '22px', fontWeight: '800' } }, '💫 Tu t\'évanouis...');
    g.ui.root.append(fade);
    requestAnimationFrame(() => { fade.style.opacity = '1'; });
    g.cutscene = true;
    setTimeout(async () => {
      try {
        const r = await g.net.request('body.ko', {});
        if (r.at) g.player.teleport(r.at.x, r.at.z, 0);
        g.ui.toast(`🏥 Réveil à l'Hôpital Saint-Bobo. Facture : ${fmt(r.bill)} PC${r.paid < r.bill ? ` (${fmt(r.bill - r.paid)} PC en dette)` : ''}.`, 'bad', 6500);
      } catch { /* déjà debout */ }
      g.cutscene = false;
      fade.style.opacity = '0';
      setTimeout(() => fade.remove(), 1100);
      this.ko = false;
    }, 1600);
  }

  // Chutes : hauteur entre le point le plus haut en l'air et l'atterrissage.
  trackFalls() {
    const g = this.game, P = g.player;
    if (P.vehicle || P.swimming || P.seated || g.player.zone !== 'world' || g.minigames?.active || performance.now() - (P.teleportedAt || 0) < 400) { this.air = null; return; }
    if (!P.grounded) { this.air = { top: Math.max(this.air?.top ?? P.pos.y, P.pos.y) }; return; }
    if (this.air) {
      const drop = this.air.top - P.pos.y;
      this.air = null;
      if (drop > 4.5) this.hurt('fall', drop);
    }
  }

  update(dt) {
    const g = this.game, b = this.b;
    if (!b) return;
    this.trackFalls();
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const fx = bodyEffects(b);
    g.player.bodySpeed = fx.speed;
    g.player.bodyNoSprint = fx.noSprint;
    g.player.bodyNoJump = fx.noJump;
    g.player.muscle = b.muscle;
    g.player.endurance = b.endurance ?? 15;
    this.fill.style.width = `${Math.round(b.health)}%`;
    this.bar.classList.toggle('low', b.health < 25);
    this.bar.title = `Santé : ${Math.round(b.health)} / 100${b.injury ? ` · ${INJURIES[b.injury.kind].name}` : ''}`;
    g.hud.track('injury', b.injury ? { title: `🩹 ${INJURIES[b.injury.kind].name}`, text: `Guérit seul dans ${Math.max(1, Math.ceil((b.injury.until - g.now()) / 60000))} min, ou soins à l'hôpital.` } : null);
    if (b.health <= 0 && !this.ko) this.knockOut();
    g.refreshAvatar();
    this.machineHud();
  }

  // ------------------------------------------------------------------ pompes
  pushups() {
    const g = this.game;
    if (g.vehicles?.driving) return;
    const P = g.player;
    const need = tapsPerPushup(this.b.muscle);
    let taps = 0, reps = 0, sent = 0;
    P.sit({ x: P.pos.x, z: P.pos.z, yaw: P.yaw, pose: 'pushup', keepSpace: true });
    const el = h('div.cook-game', h('div.t', '💪 Pompes'), this.pushBar = h('div.cook-bar', this.pushFill = h('div.cook-perfect', { style: { left: '0', width: '0%' } })), this.pushTxt = h('div.d', `Appuie ${need} fois sur ESPACE (ou clique) pour une pompe. Bouge pour arrêter.`));
    g.ui.root.append(el);
    const flush = async () => {
      const n = reps - sent;
      if (n <= 0) return;
      sent = reps;
      try { const r = await g.net.request('body.pushups', { reps: n }); g.emit('needs', r.needs); } catch (e) { g.ui.toast(e.message, 'bad'); }
    };
    const tap = () => {
      if (!P.seated || P.seated.pose !== 'pushup') return;
      taps++;
      P.pushPhase = Math.min(1, taps / need);
      this.pushFill.style.width = `${Math.round((taps / need) * 100)}%`;
      if (taps >= need) {
        taps = 0; reps++; P.pushPhase = 0; g.sfx('pop');
        this.pushTxt.textContent = `${reps} pompe${reps > 1 ? 's' : ''} ! (${need} appuis par pompe — moins quand on est musclé)`;
        if (reps % 5 === 0) flush();
      }
    };
    const off = g.input.on('key', (e) => { if (e.code === 'Space') tap(); });
    el.addEventListener('click', tap);
    const iv = setInterval(() => {
      if (!P.seated || P.seated.pose !== 'pushup') {
        clearInterval(iv); off(); el.remove(); P.pushPhase = 0; flush();
        if (reps) g.ui.toast(`💪 ${reps} pompe${reps > 1 ? 's' : ''} : tes muscles te remercient (ou te détestent).`, 'good', 3500);
      }
    }, 200);
    this.pushing = { tap, stop: () => P.stand() };
    return this.pushing;
  }

  // ------------------------------------------------------------------ salle de sport
  async startMachine(id, seat) {
    const g = this.game;
    try { await g.net.request('gym.start', { machine: id }); } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad', 4500); if (/abonnement/i.test(e.message)) gymPassPanel(g); return; }
    const m = MACHINES[id];
    this.machine = { id, at: g.now() };
    g.player.sit({ ...seat, pose: id === 'tapis' ? 'run' : id === 'velo' ? 'pedal' : 'bench', lie: id === 'banc' });
    g.ui.toast(`${m.emoji} ${m.name} lancé·e ! Tu peux lâcher le clavier : ça tourne tout seul (${MACHINE_MAX_MIN} min max). Bouge pour arrêter.`, 'good', 5000);
  }

  machineHud() {
    const g = this.game, mc = this.machine;
    if (!mc) return;
    const s = g.player.seated;
    const elapsed = (g.now() - mc.at) / 60000;
    if (!s || !['run', 'pedal'].includes(s.pose) && !(s.lie && mc.id === 'banc') || elapsed >= MACHINE_MAX_MIN) { this.stopMachine(); return; }
    const m = MACHINES[mc.id];
    g.hud.track('gym', { title: `${m.emoji} ${m.name}`, text: `${Math.floor(elapsed)}:${String(Math.floor((elapsed % 1) * 60)).padStart(2, '0')} / ${MACHINE_MAX_MIN}:00 · muscles +${(m.muscle * elapsed).toFixed(1)} · poids ${(m.weight * elapsed).toFixed(1)} kg`, bar: elapsed / MACHINE_MAX_MIN });
  }

  async stopMachine() {
    const g = this.game;
    if (!this.machine) return;
    this.machine = null;
    g.hud.track('gym', null);
    if (g.player.seated) g.player.stand();
    try {
      const r = await g.net.request('gym.stop', {});
      g.emit('needs', r.needs);
      g.sfx('success');
      g.ui.toast(`🏋️ Séance terminée (${r.minutes} min) : muscles +${r.muscle.toFixed(1)}, poids ${r.weight.toFixed(1)} kg. Pense à la douche !`, 'good', 5000);
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }
}

// ------------------------------------------------------------------------------------ panneaux
export function gymPassPanel(g) {
  const m = g.ui.modal({
    title: '🎫 Accueil de la salle de sport', sub: 'Un abonnement donne accès aux machines (qui tournent toutes seules). Les pompes, c\'est gratuit et partout !',
    build: (body) => {
      const until = g.profile.body.gymUntil || 0;
      body.append(h('p', until > g.now() ? `✅ Abonnement valable encore ${Math.ceil((until - g.now()) / 3600_000)} h de temps réel.` : '❌ Pas d\'abonnement en cours.'));
      for (const [k, p] of Object.entries(GYM_PASSES)) body.append(h('div.list-item', h('div.grow', h('div.t', p.name), h('div.d', `${fmt(p.price)} PC · ${p.ms / 3600_000} h réelles`)),
        h('button.btn.small', { onclick: async () => { try { await g.net.request('gym.pass', { kind: k }); g.sfx('cash'); m.refresh(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, 'Prendre')));
    },
  });
}

export function hairPanel(g) {
  const a = g.profile.appearance;
  let hair = a.hair, color = a.hairColor;
  const m = g.ui.modal({
    title: '✂️ Salon Tifs & Brushing', sub: `Coupe ${HAIR_PRICES.coupe} PC · couleur ${HAIR_PRICES.couleur} PC · les deux ${HAIR_PRICES.both} PC. Une coupe fraîche, ça plaît (+ attirance pendant 3 h).`,
    onClose: () => g.refreshAvatar?.(),
    build: (body) => {
      const preview = () => g.previewAppearance({ ...g.profile.appearance, hair, hairColor: color });
      body.append(h('div.field', h('label', 'Coupe'), h('div.opt-row', HAIR_STYLES.map((s) => h(`button.opt${hair === s ? '.sel' : ''}`, { onclick: () => { hair = s; preview(); m.refresh(); } }, HAIR_LABELS[s] || s)))));
      body.append(h('div.field', h('label', 'Couleur'), h('div.swatches', HAIR_COLORS.map((c) => h(`button.swatch${color === c ? '.sel' : ''}`, { style: { background: c }, onclick: () => { color = c; preview(); m.refresh(); } })))));
      const same = hair === a.hair && color === a.hairColor;
      const price = hair !== a.hair && color !== a.hairColor ? HAIR_PRICES.both : color !== a.hairColor ? HAIR_PRICES.couleur : HAIR_PRICES.coupe;
      body.append(h('button.btn', { onclick: async () => {
        try { await g.net.request('hair.cut', { hair, hairColor: color }); g.sfx('success'); g.ui.toast(same ? '✂️ Rafraîchissement de la coupe : impeccable !' : '✂️ Nouvelle tête ! Tout le monde va te remarquer.', 'good'); m.close(); } catch (e) { g.ui.toast(e.message, 'bad'); }
      } }, same ? `Rafraîchir la coupe (${price} PC)` : `Valider (${price} PC)`));
    },
  });
}

export function hospitalCarePanel(g) {
  const b = g.profile.body;
  const cost = 40 + (b.injury ? INJURIES[b.injury.kind].care : 0) + Math.round((100 - b.health) * 2);
  g.ui.dialog({ name: 'Dr Bobo', role: 'Urgences', text: b.injury || b.health < 99 ? `${b.injury ? `${INJURIES[b.injury.kind].name} : on va arranger ça.` : 'Un petit coup de fatigue ?'} Santé ${Math.round(b.health)}/100. Soins complets : ${cost} PC.` : 'Vous êtes en pleine forme. Revenez quand vous serez cassé·e (mais pas trop).', choices: [
    ...(b.injury || b.health < 99 ? [{ label: `🩹 Me soigner (${cost} PC)`, action: async (m) => { try { const r = await g.net.request('hospital.treat', {}); g.sfx('success'); m.show(`Et voilà ! ${r.healed ? 'Plus de blessure, ' : ''}santé à 100. Ça fera ${r.cost} PC.`, [{ label: 'Merci docteur', ghost: true, action: (x) => x.close() }]); } catch (e) { m.show(e.message, [{ label: 'OK', ghost: true, action: (x) => x.close() }]); } } }] : []),
    { label: '💉 Clinique esthétique (âge)', action: (m) => { m.close(); clinicPanel(g); } },
    { label: 'Au revoir', ghost: true, action: (m) => m.close() },
  ] });
}

export function clinicPanel(g) {
  const m = g.ui.modal({
    title: '💉 Clinique Saint-Bobo', sub: 'On vieillit en jouant (6 h de jeu = 1 an). Ici, on peut figer son âge ou le choisir.',
    build: (body) => {
      const b = g.profile.body;
      body.append(h('p', `Âge actuel : ${b.age} ans${b.ageFrozen ? ' (figé ❄️)' : ''}.`));
      body.append(h('button.btn.small', { disabled: b.ageFrozen, onclick: () => op('freeze') }, `❄️ Figer mon âge (${fmt(CLINIC.freeze)} PC)`));
      if (b.ageFrozen) body.append(h('button.btn.small.ghost', { onclick: () => op('unfreeze') }, 'Laisser le temps passer à nouveau (gratuit)'));
      body.append(h('h4', { style: { marginTop: '12px' } }, `Choisir son âge (${fmt(CLINIC.choose)} PC)`));
      body.append(h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, [18, 20, 25, 30, 35, 40, 50, 60, 70].map((a) => h('button.btn.small.ghost', { onclick: () => op('choose', a) }, `${a} ans`))));
    },
  });
  async function op(action, age) {
    try { const r = await g.net.request('clinic.age', { action, age }); g.sfx('success'); g.ui.toast(`💉 Âge : ${r.age} ans${r.frozen ? ' (figé)' : ''}.`, 'good'); m.refresh(); } catch (e) { g.ui.toast(e.message, 'bad'); }
  }
}

// Appli Santé (téléphone).
export function healthApp(g, b) {
  const p = g.profile, bd = p.body, items = g.net.content.items;
  const st = needsStatus(p.needs, g.now());
  const att = attractiveness(p, items, g.now(), st.hygiene);
  const line = (icon, t, d) => b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, icon), h('div.grow', h('div.t', t), d ? h('div.d', d) : null)));
  line('❤️', `Santé : ${Math.round(bd.health)} / 100`, bd.injury ? `🩹 ${INJURIES[bd.injury.kind].name} (guérit dans ${Math.max(1, Math.ceil((bd.injury.until - g.now()) / 60000))} min)` : 'Aucune blessure.');
  line('⚖️', `Poids : ${bd.weight.toFixed(1)} kg`, bd.weight > 95 ? 'Un peu lourd : moins rapide, moins d\'endurance.' : bd.weight < 58 ? 'Trop maigre : tu es plus faible. Mange mieux !' : 'Silhouette au top.');
  line('💪', `Muscles : ${Math.round(bd.muscle)} / 100`, `${tapsPerPushup(bd.muscle)} appuis par pompe · ${bd.muscle > 60 ? 'abdos visibles torse nu !' : 'continue l\'entraînement'}`);
  line('🎂', `Âge : ${bd.age} ans${bd.ageFrozen ? ' (figé)' : ''}`, `Prochain anniversaire dans ${Math.ceil(360 - (bd.ageMins || 0))} min de jeu.`);
  line('✨', `Attirance : ${att.total} / 100`, Object.entries(att.parts).filter(([, v]) => Math.round(v)).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${Math.round(v)}`).join(' · '));
  b.append(h('button.btn.block', { style: { marginTop: '8px' }, onclick: () => { g.phone.close(); g.body.pushups(); } }, '💪 Faire des pompes ici (gratuit)'));
  b.append(h('p.muted', 'Trop manger quand on n\'a plus faim fait grossir ; ne pas manger fait maigrir et fondre les muscles. Salle de sport : abonnement à l\'accueil. Parfum et vêtements chers augmentent l\'attirance.'));
}
