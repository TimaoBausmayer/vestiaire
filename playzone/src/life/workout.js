import { h, fmt } from '../ui/dom.js';
import { EXOS, EXO_IDS, EXO_LEVELS, exoLevel, tapsPer, dailyProgram, PROGRAM_BONUS, defaultWorkout } from '../../shared/workout.js';
import { todayKey } from '../../shared/rules.js';
import { OPPONENTS } from '../../shared/boxing.js';

// EXERCICES PARTOUT : un mini-jeu par type d'exercice.
//  tap  : appuyer vite sur Espace (pompes, squats, burpees)
//  alt  : alterner J / L (jumping jacks, abdos)
//  hold : garder l'aiguille dans la zone verte en dosant Espace (gainage, étirements)
//  beat : appuyer en rythme (corde à sauter)
// Bouger (ou « Stop ») termine la série ; l'autorité valide et applique les gains.
const MAX_SECS = 90;

export class Workout {
  constructor(g) {
    this.g = g;
    this.s = null;
    g.input.on('key', (e) => {
      const s = this.s;
      if (!s) return;
      if (e.code === 'Space' && (s.mode === 'tap' || s.mode === 'beat')) this.press();
      if (s.mode === 'alt' && e.code === 'KeyJ') this.side(-1);
      if (s.mode === 'alt' && e.code === 'KeyL') this.side(1);
      if (e.code === 'Escape') this.stop();
    });
  }

  rec() { return { ...defaultWorkout(), ...(this.g.profile.workout || {}) }; }

  async start(exo) {
    const g = this.g, E = EXOS[exo];
    if (this.s || g.vehicles?.driving || g.boxing?.busy) return;
    try { await g.net.request('workout.start', { exo }); } catch (e) { g.ui.toast(e.message, 'bad', 3500); g.sfx('error'); return; }
    const P = g.player, lvl = exoLevel(this.rec().xp[exo]);
    const s = this.s = { exo, E, mode: E.mode, t: 0, n: 0, taps: 0, need: tapsPer(exo, g.profile.body?.muscle ?? 30, lvl), last: 0, needle: 0.5, inZone: 0, lastBeat: -1 };
    // posture (au sol pour pompes et gainage, debout sinon) ; pas de saut avec Espace pendant l'exercice
    P.sit({ x: P.pos.x, z: P.pos.z, yaw: P.yaw, pose: E.pose === 'plank' ? 'pushup' : E.pose, stand: !['pushup', 'plank'].includes(E.pose), y: 0, keepSpace: true, workout: exo });
    if (E.pose === 'plank') P.pushPhase = 0.65;
    P.noJump = true;
    const help = { tap: 'Appuie vite sur ESPACE (ou le bouton)', alt: 'Alterne J et L (ou les boutons ⬅️ ➡️)', hold: 'Dose ESPACE (maintenir / relâcher) pour garder l\'aiguille dans le vert', beat: 'Appuie sur ESPACE pile quand l\'anneau se referme' }[s.mode];
    s.count = h('b.wk-count', '0');
    s.bar = h('div.wk-bar', s.fill = h('i'), s.mode === 'hold' ? (s.zone = h('span.wk-zone')) : null, s.mode === 'hold' ? (s.pin = h('span.wk-pin')) : null);
    s.ring = s.mode === 'beat' ? h('div.club-ring') : null;
    s.el = h('div.wk-box', h('div', `${E.emoji} ${E.name} · niveau ${lvl}`), s.ring, s.count, h('small', E.unit === 'secs' ? 'secondes' : 'répétitions'), s.bar, h('small.muted', help));
    const btn = (label, fn) => h('button', { onpointerdown: (e) => { e.preventDefault(); fn(true); }, onpointerup: () => fn(false), onpointerleave: () => fn(false) }, label);
    s.btns = h('div.foot-btns',
      s.mode === 'alt' ? [btn('⬅️', (d) => d && this.side(-1)), btn('➡️', (d) => d && this.side(1))]
        : s.mode === 'hold' ? btn('✊ Tenir', (d) => { this.holdBtn = d; }) : btn('👊 Go !', (d) => d && this.press()),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.stop(); } }, '⏹️ Stop'));
    g.ui.root.append(s.el, s.btns);
    g.sfx('go');
  }

  press() {
    const s = this.s, g = this.g;
    if (!s) return;
    if (s.mode === 'tap') {
      if (s.t - s.last < 0.06) return;   // anti-auto-clic
      s.last = s.t; s.taps++;
      if (s.exo === 'pompes') g.player.pushPhase = Math.min(1, s.taps / s.need);
      if (s.taps >= s.need) { s.taps = 0; s.n++; g.sfx('pop'); if (s.exo === 'pompes') g.player.pushPhase = 0; }
    } else if (s.mode === 'beat') {
      const P = s.E.period, k = Math.round(s.t / P), off = Math.abs(s.t - k * P);
      if (off < s.E.window && k !== s.lastBeat) { s.lastBeat = k; s.n++; g.sfx('pop'); s.ring?.classList.remove('hit'); void s.ring?.offsetWidth; s.ring?.classList.add('hit'); }
      else if (k !== s.lastBeat) { s.lastBeat = k; g.sfx('click'); }   // raté : on s'emmêle dans la corde
    }
  }

  side(d) {
    const s = this.s;
    if (!s || s.mode !== 'alt' || d === s.lastSide) return;
    s.lastSide = d; s.taps++;
    if (s.taps >= s.need) { s.taps = 0; s.n++; this.g.sfx('pop'); }
  }

  stop() { if (this.s) { this.s.stopping = true; if (this.g.player.seated?.workout) this.g.player.stand(); } }

  async finish() {
    const s = this.s, g = this.g, P = g.player;
    if (!s) return;
    this.s = null;
    s.el.remove(); s.btns.remove();
    P.noJump = false; P.pushPhase = 0;
    if (P.seated?.workout) P.stand();
    const amount = s.mode === 'hold' ? Math.floor(s.inZone) : s.n;
    let r;
    try { r = await g.net.request('workout.end', { amount }); } catch (e) { g.ui.toast(e.message, 'bad'); return; }
    if (r.needs) g.emit('needs', r.needs);
    const E = s.E;
    if (r.amount > 0) {
      g.sfx(r.record ? 'levelup' : 'success');
      g.ui.toast(`${E.emoji} ${E.name} : ${r.amount} ${E.unit === 'secs' ? 's' : 'rép.'}${r.record ? ' · 🏅 nouveau record !' : ''} · niveau ${r.level}`, 'good', 4500);
    }
    if (r.program) setTimeout(() => { g.sfx('levelup'); g.ui.toast(`🏆 Programme du jour terminé ! +${fmt(r.bonus)} PC, +${PROGRAM_BONUS.xp} XP · série de ${r.streak} jour${r.streak > 1 ? 's' : ''} 🔥`, 'good', 6000); }, 900);
  }

  update(dt) {
    const s = this.s, g = this.g;
    if (!s) return;
    s.t += dt;
    if (!g.player.seated?.workout || s.t > MAX_SECS) { this.finish(); return; }
    if (s.mode === 'hold') {
      // l'aiguille dérive (de plus en plus vite), Espace la pousse vers la droite
      const push = g.input.keys.has('Space') || this.holdBtn;
      s.drift = (s.drift || 0) + (Math.random() - 0.5) * dt * 3;
      s.drift = Math.max(-0.6, Math.min(0.6, s.drift));
      s.needle += ((push ? 0.55 : -0.45) + s.drift * (1 + s.t / 40)) * dt;
      s.needle = Math.max(0, Math.min(1, s.needle));
      const ok = s.needle > 0.35 && s.needle < 0.65;
      if (ok) s.inZone += dt;
      s.pin.style.left = `${s.needle * 100}%`;
      s.zone.classList.toggle('ok', ok);
      s.count.textContent = Math.floor(s.inZone);
    } else {
      s.count.textContent = s.n;
      s.fill.style.width = `${(s.mode === 'beat' ? ((s.t % s.E.period) / s.E.period) : s.taps / s.need) * 100}%`;
      if (s.ring) { const ph = (s.t % s.E.period) / s.E.period; s.ring.style.transform = `scale(${1.6 - ph * 0.6})`; }
    }
  }
}

// ------------------------------------------------------------------ appli Sport
export function sportApp(g, b) {
  const w = { ...defaultWorkout(), ...(g.profile.workout || {}) }, day = todayKey(g.now());
  const prog = dailyProgram(day), done = w.day === day ? w.done : {};
  b.append(h('h3', '🏆 Programme du jour'));
  b.append(h('p.muted', `3 exercices, les mêmes pour tout le monde aujourd'hui. Tout réussi : +${PROGRAM_BONUS.coins} PC (plus encore en enchaînant les jours) · série actuelle : ${w.streak || 0} 🔥`));
  for (const st of prog) {
    const E = EXOS[st.id], v = done[st.id] || 0, okk = v >= st.target;
    b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, okk ? '✅' : E.emoji),
      h('div.grow', h('div.t', `${E.name} : ${st.target} ${E.unit === 'secs' ? 'secondes' : 'répétitions'}`), h('div.d', `Meilleure série aujourd'hui : ${v}`)),
      h('button.btn.small', { onclick: () => { g.phone.close(); g.workout.start(st.id); } }, okk ? 'Refaire' : 'Go !')));
  }
  b.append(h('h3', { style: { marginTop: '12px' } }, '💪 Tous les exercices (partout, gratuits)'));
  for (const id of EXO_IDS) {
    const E = EXOS[id], xp = w.xp[id] || 0, lvl = exoLevel(xp), next = EXO_LEVELS[lvl + 1];
    b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, E.emoji),
      h('div.grow', h('div.t', `${E.name} · niveau ${lvl}/10`), h('div.d', `Record : ${w.best[id] || 0} ${E.unit === 'secs' ? 's' : 'rép.'} · total ${w.total[id] || 0}${next ? ` · prochain niveau à ${next}` : ' · niveau max !'}`)),
      h('button.btn.small', { onclick: () => { g.phone.close(); g.workout.start(id); } }, 'Go !')));
  }
  // palmarès de tous les sports
  const S = g.profile.sports || {}, f = S.foot || {}, bx = S.boxing || {};
  const rows = [
    ['⚽ Football', `${f.matches || 0} matchs · ${f.wins || 0} victoires · ${f.goals || 0} buts`],
    ['🥊 Boxe', `${bx.wins || 0} victoires (${bx.kos || 0} KO) · ${bx.beaten >= 0 ? `dernier battu : ${OPPONENTS[bx.beaten]?.name}` : 'aucun adversaire battu'}`],
    ['🎾 Tennis', `${S.tennis?.wins || 0} victoires · ${S.tennis?.matches || 0} matchs`],
    ['🏊 Natation', `${S.swim?.wins || 0} victoires · meilleur 50 m : ${S.swim?.best ? `${S.swim.best.toFixed(2)} s` : '—'}`],
    ['⛳ Mini-golf', `${S.golf?.rounds || 0} parcours · record : ${S.golf?.best ? `${S.golf.best} coups` : '—'}`],
    ['💃 Danse', `record : ${g.profile.stats?.danceBest || 0}`],
    ['🏋️ Corps', `muscles ${Math.round(g.profile.body?.muscle || 0)}/100 · endurance ${Math.round(g.profile.body?.endurance ?? 15)}/100`],
  ];
  b.append(h('h3', { style: { marginTop: '12px' } }, '🏅 Mon palmarès'));
  for (const [t, d] of rows) b.append(h('div.list-item', h('div.grow', h('div.t', t), h('div.d', d))));
}
