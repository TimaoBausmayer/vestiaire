import { h, fmt } from '../ui/dom.js';
import { EXOS, EXO_IDS, EXO_LEVELS, exoLevel, tapsPer, dailyProgram, PROGRAM_BONUS, defaultWorkout } from '../../shared/workout.js';
import { todayKey } from '../../shared/rules.js';
import { OPPONENTS } from '../../shared/boxing.js';
import { CAREER_SPORTS, DIVISIONS, divisionOf, dailySalary, salaryClaimable } from '../../shared/career.js';
import { PROFILS, profilOf } from '../../shared/athlete.js';
import { SPORT_CLUBS, STARS, myClub, stars as starTxt } from '../../shared/clubs.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { weightLabel, IDEAL_WEIGHT } from '../../shared/body.js';

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
export function sportApp(g, b, refresh) {
  const w = { ...defaultWorkout(), ...(g.profile.workout || {}) }, day = todayKey(g.now());
  const P = g.profile, B = P.body;
  // ---- mon physique : ce qui sert dans tous les sports
  const meter = (label, v, color, hint) => h('div.list-item', h('div.grow', h('div.t', `${label} : ${Math.round(v)}/100`), h('div', { style: { height: '8px', background: 'rgba(255,255,255,.12)', borderRadius: '6px', marginTop: '4px' } }, h('div', { style: { width: `${Math.max(0, Math.min(100, v))}%`, height: '100%', background: color, borderRadius: '6px' } })), hint ? h('div.d', hint) : null));
  b.append(h('h3', '🧬 Mon physique'));
  b.append(meter('⚡ Vitesse', B.vitesse ?? 10, '#ffbe0b', 'Pointe en sprint : 100 m, foot, tennis... Monte en sprintant et au 100 m.'));
  b.append(meter('🫁 Endurance', B.endurance ?? 15, '#2ec4b6', 'Souffle et fatigue : footing, 10 km, semi, marathon, matchs, natation.'));
  b.append(meter('💪 Muscles', B.muscle ?? 15, '#e63946', 'Force : boxe, tirs au foot, salle de sport, exercices.'));
  b.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, '⚖️'), h('div.grow', h('div.t', `Poids : ${B.weight.toFixed(1).replace('.', ',')} kg (${weightLabel(B.weight)})`), h('div.d', `Idéal ≈ ${IDEAL_WEIGHT} kg. Trop manger (surtout burgers, pizzas, tacos, sodas) fait grossir ; manger sain et faire du sport fait maigrir. Les kilos en trop t'essoufflent et te ralentissent.`))));
  // ---- spécialité
  const cur = profilOf(B);
  b.append(h('h3', { style: { marginTop: '12px' } }, '🎯 Ma spécialité'));
  for (const [id, Pf] of Object.entries(PROFILS)) {
    const on = (B.profil || 'polyvalent') === id;
    b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, Pf.icon), h('div.grow', h('div.t', `${Pf.name}${on ? ' ✅' : ''}`), h('div.d', Pf.desc)),
      on ? null : h('button.btn.small', { onclick: async () => { try { await g.net.request('athle.profil', { profil: id }); g.sfx('success'); g.ui.toast(`${Pf.icon} Nouvelle spécialité : ${Pf.name}`, 'good'); refresh?.(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, 'Choisir')));
  }
  void cur;
  // ---- carrières
  b.append(h('h3', { style: { marginTop: '12px' } }, '🏅 Mes carrières'));
  b.append(h('p.muted', `Chaque compétition rapporte des points de carrière. Divisions : ${DIVISIONS.map((d) => d.name).join(' → ')}. Plus haut = primes ×${DIVISIONS[1].mult} à ×${DIVISIONS[DIVISIONS.length - 1].mult}, adversaires plus forts et salaire de sponsor chaque jour.`));
  const sal = dailySalary(P);
  b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, '💼'), h('div.grow', h('div.t', `Salaire de sponsor : ${fmt(sal)} PC / jour`), h('div.d', sal ? 'La somme de tous tes sports en division Régionale ou plus.' : 'Monte en division Régionale dans un sport pour avoir un sponsor.')),
    salaryClaimable(P, g.now()) ? h('button.btn.small', { onclick: async () => { try { const r = await g.net.request('career.salary', {}); g.sfx('cash'); g.ui.toast(`💼 Salaire de sponsor : +${fmt(r.amount)} PC`, 'money'); refresh?.(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, 'Toucher') : h('span.pill', sal ? 'touché ✅' : '—')));
  // ---- clubs (4 par sport, réputations différentes)
  b.append(h('h3', { style: { marginTop: '12px' } }, '🏟️ Mes clubs'));
  b.append(h('p.muted', 'Petit club = gratuit et ouvert à tous. Grand club = division exigée et cotisation, mais plus de points de carrière, de plus grosses primes, une prime de club chaque jour et (au foot) de meilleurs coéquipiers.'));
  for (const [sp, list] of Object.entries(SPORT_CLUBS)) {
    const S = CAREER_SPORTS[sp], mine = myClub(P, sp, g.now()), m = P.clubs?.[sp];
    b.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, S.icon), h('div.grow', h('div.t', `${S.name} · ${mine ? `${mine.name} ${starTxt(mine.stars)}` : m ? 'cotisation expirée' : 'sans club'}`),
      h('div.d', mine && STARS[mine.stars].fee ? `Cotisation à jour encore ${Math.max(1, Math.ceil((m.until - g.now()) / 600_000))} h de jeu` : `${list.length} clubs : ${list.map((c) => `${c.name} ${'★'.repeat(c.stars)}`).join(' · ')}`)),
      h('button.btn.small', { onclick: () => clubPicker(g, sp, refresh) }, mine ? 'Gérer' : 'Choisir')));
  }
  for (const [id, S] of Object.entries(CAREER_SPORTS)) {
    const c = P.career?.[id] || { pts: 0, comps: 0, wins: 0 }, d = divisionOf(c.pts);
    const prog = d.next ? (c.pts - d.pts) / (d.next.pts - d.pts) : 1;
    b.append(h('div.list-item', h('span', { style: { fontSize: '22px' } }, S.icon), h('div.grow', h('div.t', `${S.name} · ${d.name}`),
      h('div', { style: { height: '6px', background: 'rgba(255,255,255,.12)', borderRadius: '6px', margin: '4px 0' } }, h('div', { style: { width: `${Math.round(prog * 100)}%`, height: '100%', background: '#8338ec', borderRadius: '6px' } })),
      h('div.d', `${c.pts} pts${d.next ? ` · ${d.next.name} à ${d.next.pts}` : ' · sommet atteint !'} · ${c.comps || 0} compétitions · ${c.wins || 0} victoires · primes ×${d.mult}`))));
  }
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

// Choix d'un club pour un sport : réputation, conditions, cotisation, avantages
export function clubPicker(g, sport, refresh) {
  const P = g.profile, div = divisionOf(P.career?.[sport]?.pts || 0);
  const m = g.ui.modal({
    title: `${CAREER_SPORTS[sport].icon} Clubs de ${CAREER_SPORTS[sport].name}`,
    sub: `Ta division : ${div.name}. Cotisation pour une semaine de jeu, renouvelable.`,
    width: 'min(600px, 96vw)',
    build: (body) => {
      const mine = myClub(P, sport, g.now());
      for (const c of SPORT_CLUBS[sport]) {
        const S = STARS[c.stars], locked = div.i < S.need && !P.admin, site = c.site && BUILDING_BY_ID[c.site];
        body.append(h('div.list-item', h('span', { style: { fontSize: '15px', color: '#ffbe0b', minWidth: '74px' } }, starTxt(c.stars)),
          h('div.grow', h('div.t', `${c.name}${mine?.id === c.id ? ' ✅' : ''}`), h('div.d', c.desc),
            h('div.d', `${S.fee ? `${S.fee} PC / semaine` : 'Gratuit'}${S.need ? ` · division ${['Amateur', 'Régional', 'National', 'Pro'][S.need]} exigée` : ''} · points ×${S.pts} · primes ×${S.prize}${S.daily ? ` · prime de club ${S.daily} PC/jour` : ''}${sport === 'foot' && S.mate ? ' · coéquipiers plus forts' : ''}`)),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            site ? h('button.btn.small.ghost', { onclick: () => { m.close(); g.phone?.goTo?.({ x: site.door?.x ?? site.x, z: site.door?.z ?? site.z, name: c.name }); } }, '📍 GPS') : null,
            h('button.btn.small', { disabled: locked, onclick: async () => { try { const r = await g.net.request('club.join', { sport, club: c.id }); g.sfx('levelup'); g.ui.toast(`🏟️ Bienvenue au ${r.club} !${r.fee ? ` Cotisation : ${r.fee} PC.` : ''}`, 'good', 4000); m.close(); refresh?.(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, locked ? '🔒' : mine?.id === c.id ? (S.fee ? 'Renouveler' : 'Membre') : 'Rejoindre'))));
      }
      if (P.clubs?.[sport]) body.append(h('button.btn.small.ghost', { style: { marginTop: '8px' }, onclick: async () => { try { await g.net.request('club.leave', { sport }); g.ui.toast('Tu as quitté ton club.', '', 2500); m.close(); refresh?.(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, 'Quitter mon club'));
    },
  });
}
