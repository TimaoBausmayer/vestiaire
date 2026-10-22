import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { StaticBuilder } from '../core/static-builder.js';
import { MATS } from '../core/materials.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS, COLORS } from '../../shared/appearance.js';
import { PLAYGROUND, inPlayground, COUR_GAMES, COUR_NAMES, courReward } from '../../shared/playground.js';
import { liveOf, CAL_BY_ID, minutesUntil } from '../../shared/calendar.js';
import { mulberry32, shuffle } from '../../shared/rng.js';
import { calNow } from '../events/agenda.js';

// JEUX DE COUR au parc des Tilleuls : cache-cache (se cacher / chercher) et loup, contre des PNJ qui
// se cachent derrière les arbres et les haies, regardent autour d'eux, fuient, se trompent... et râlent.

const P = PLAYGROUND;
const LINES = {
  found: ['Zut ! Mon chapeau dépassait...', 'Pas juste, j\'allais changer de cachette !', 'Bien vu ! Tu as des yeux de lynx.', 'Je faisais semblant d\'être un arbre. Raté.'],
  tagged: ['Aïe ! Bon, je suis cuit·e.', 'Pas le droit, j\'étais perché·e ! ... Non ? D\'accord.', 'Tu cours trop vite, c\'est de la triche !', 'Je me suis pris les pieds dans un pigeon !'],
  seek: ['Prêt ou pas, j\'arrive !', 'Je vois une ombre suspecte...', 'Sortez, je sais que vous êtes là !', 'Hmm, ce buisson respire bizarrement.'],
  foundYou: ['TROUVÉ·E ! Derrière cet arbre, sérieux ?', 'Coucou ! Je t\'ai vu·e de loin !', 'Ha ! Ta chaussure dépassait !'],
  taunt: ['Même pas cap de m\'attraper !', 'Trop lent, le loup !', 'Je suis le vent !'],
};
const pick = (r, a) => a[Math.floor(r() * a.length)];
// haies ajoutées dans le parc (cachettes) : positions relatives au centre
const HEDGES = [[-17, -3, 0], [-8, 3, 1], [9, -3, 1], [17, 3, 0], [-20, 3, 1], [20, -3, 0], [0, 4, 0]];

function look(r) {
  return { ...DEFAULT_APPEARANCE, skin: pick(r, SKINS.slice(0, 8)), hair: pick(r, HAIR_STYLES), hairColor: pick(r, HAIR_COLORS.slice(0, 7)), topColor: pick(r, COLORS), bottomColor: pick(r, ['#2b2d42', '#3d8ee8', '#7a5230']) };
}

export class Cour {
  constructor(g) {
    this.g = g;
    this.cur = null;
    // décor : haies et panneau des jeux
    const sb = new StaticBuilder(Infinity);
    this.hedges = [];
    for (const [dx, dz, rot] of HEDGES) {
      const x = P.x + dx, z = P.z + dz, w = rot ? 1 : 3.2, d = rot ? 3.2 : 1;
      let free = true;
      g.collision.near(x, z, 2.5, (c) => { if (!c.dynamic) free = false; });
      if (!free) continue;
      sb.box(x, 0, z, w, 1.5, d, '#2d6a4f'); sb.box(x, 1.5, z, w * 0.9, 0.25, d * 0.9, '#40916c');
      g.collision.addBoxC(x, z, w, d, 0, 1.6);
      this.hedges.push({ x, z });
    }
    const bx = P.x - 8, bz = P.z - P.d / 2 - 1.2;
    sb.box(bx - 1.3, 0, bz, 0.12, 2.4, 0.12, '#6b4f3a'); sb.box(bx + 1.3, 0, bz, 0.12, 2.4, 0.12, '#6b4f3a');
    sb.box(bx, 1.3, bz, 2.8, 1.1, 0.1, '#ffd23f');
    g.engine.scene.add(sb.build(MATS));
    g.collision.addBoxC(bx, bz, 2.8, 0.3, 0, 2.4);
    g.interactions.add({ x: bx, z: bz + 1.2, r: 2.5, priority: 2, label: '🎲 Jeux de cour : cache-cache, loup', enabled: () => !this.cur, action: () => this.panel() });
  }

  // Cachettes : derrière les obstacles du parc (arbres, toboggan, haies), côté opposé au centre.
  spots() {
    const out = [];
    this.g.collision.near(P.x, P.z, Math.max(P.w, P.d) / 2 + 2, (c) => {
      if (c.dynamic || c.maxY < 1.2) return;
      const cx = c.type === 'cyl' ? c.x : (c.minX + c.maxX) / 2, cz = c.type === 'cyl' ? c.z : (c.minZ + c.maxZ) / 2;
      if (!inPlayground(cx, cz, -1.5)) return;
      const r = c.type === 'cyl' ? c.r : Math.max(c.maxX - c.minX, c.maxZ - c.minZ) / 2;
      const dx = cx - P.x, dz = cz - P.z, d = Math.hypot(dx, dz) || 1;
      out.push({ x: cx + (dx / d) * (r + 0.8), z: cz + (dz / d) * (r + 0.8) });
    });
    return out.filter((s) => inPlayground(s.x, s.z, -0.5));
  }

  panel() {
    const g = this.g;
    const m = g.ui.modal({
      title: '🎲 Jeux de cour du parc des Tilleuls', sub: 'Contre les habitants du quartier (PNJ). Gratuit : petites récompenses, records et tournois du calendrier.',
      width: 'min(600px, 96vw)',
      build: (b) => {
        const now = calNow(g);
        for (const [id, G] of Object.entries(COUR_GAMES)) {
          const st = g.profile.minigames?.[`cour-${id}`];
          const live = liveOf((e) => e.kind === 'minigame' && e.minigame === `cour-${id}`, now)[0];
          b.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, G.emoji),
            h('div.grow', h('div.t', G.name, live ? h('span.pill.warn', { style: { marginLeft: '6px' } }, `Tournoi en cours (${minutesUntil(live.end, now)} min)`) : null),
              h('div.d', G.rules), h('div.d', `Record : ${st?.best ?? '—'}${id === 'cachette' ? ' s' : ''} · récompense jusqu'à ${courReward(id, 999)} PC`)),
            h('div.col-btns',
              live && !g.profile.calendar?.reg?.[live.occ] ? h('button.btn.small.ghost', { onclick: async () => { try { await g.net.request('cal.register', { occ: live.occ }); g.sfx('success'); m.refresh(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, 'S\'inscrire au tournoi') : null,
              h('button.btn.small', { onclick: () => { m.close(); this.start(id); } }, 'Jouer'))));
        }
      },
    });
  }

  async start(id) {
    const g = this.g, G = COUR_GAMES[id];
    let r;
    try { r = await g.net.request('cour.start', { game: id }); } catch (e) { g.ui.toast(e.message, 'bad'); return; }
    const rand = mulberry32(r.seed);
    const spots = shuffle(rand, this.spots());
    const names = shuffle(rand, COUR_NAMES);
    const npcs = [];
    for (let i = 0; i < G.npcs; i++) {
      const av = new Avatar(look(rand), {});
      const x = P.x + (rand() - 0.5) * 6, z = P.z + (rand() - 0.5) * 4;
      av.root.position.set(x, 0.05, z);
      g.engine.scene.add(av.root);
      const label = document.createElement('div');
      label.className = 'wlabel';
      label.textContent = `${names[i]} (PNJ)`;
      const lab = g.labels.add(av.root, label, 2.3, 30);
      npcs.push({ name: names[i], av, lab, target: null, spot: spots[i % Math.max(1, spots.length)], state: 'idle', speed: 3.6 + rand() * 1.6, smart: rand() < 0.4, wait: 0, out: false, yaw: 0 });
    }
    this.cur = { id, G, rand, npcs, spots, t: -G.count, start: performance.now(), found: 0, survived: 0, over: false, seeker: null, hud: h('div.mg-hud', h('div.box', h('b', '0'), h('span', 'Temps')), h('div.box', h('b', '0'), h('span', id === 'cachette' ? 'Tenu (s)' : id === 'loup' ? 'Touchés' : 'Trouvés'))) };
    g.ui.root.append(this.cur.hud);
    const c = this.cur;
    if (id === 'cachette') {
      // le premier PNJ cherche, les autres se cachent aussi
      c.seeker = npcs[0];
      c.seeker.av.root.position.set(P.x, 0.05, P.z);
      c.seeker.state = 'count';
      for (const n of npcs.slice(1)) n.state = 'hide';
      g.ui.toast(`🙈 ${c.seeker.name} compte jusqu'à ${G.count}... Cache-toi dans le parc !`, 'event', 5000);
    } else if (id === 'cherche') {
      for (const n of npcs) n.state = 'hide';
      g.ui.toast(`🔎 Tu comptes jusqu'à ${G.count}... (ne regarde pas !) Puis trouve les ${G.npcs} habitants.`, 'event', 5000);
      c.inters = npcs.map((n) => g.interactions.add({ x: 0, z: 0, r: 2.6, priority: 3, label: `🔎 Trouvé : ${n.name} !`, enabled: () => this.cur && this.cur.t >= 0 && !n.out && Math.hypot(n.av.root.position.x - g.player.pos.x, n.av.root.position.z - g.player.pos.z) < 2.6, action: () => this.catch(n) }));
    } else {
      for (const n of npcs) { n.state = 'run'; n.av.root.position.set(P.x + (rand() - 0.5) * 30, 0.05, P.z + (rand() - 0.5) * 16); }
      g.ui.toast(`🐺 Tu es le loup ! Touche les ${G.npcs} habitants en ${G.duration} s.`, 'event', 5000);
    }
  }

  say(n, text) { this.g.labels.bubble(n.av.root, text, 2500); }

  async catch(n) {
    const g = this.g, c = this.cur;
    if (!c || n.out) return;
    n.out = true; n.state = 'out';
    n.target = { x: P.x - 8 + c.found * 1.1, z: P.z - P.d / 2 + 1 };
    this.say(n, pick(c.rand, c.id === 'loup' ? LINES.tagged : LINES.found));
    g.sfx('success');
    try { const r = await g.net.request('cour.catch', {}); c.found = r.n; } catch { c.found++; }
    if (c.npcs.every((x) => x.out)) this.finish(true);
  }

  // Le PNJ chercheur voit-il le joueur ? (devant lui, assez près, rien entre eux)
  sees(n, pos) {
    const a = n.av.root.position, dx = pos.x - a.x, dz = pos.z - a.z, d = Math.hypot(dx, dz);
    if (d < 2) return true;
    if (d > 7) return false;
    const fx = Math.sin(n.yaw), fz = Math.cos(n.yaw);
    if ((dx * fx + dz * fz) / d < 0.5) return false;
    return this.g.collision.segmentFree(a.x, 1.5, a.z, pos.x, 1.2, pos.z, 12) > 0.97;
  }

  steer(n, dt, tx, tz, sp) {
    const p = n.av.root.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { n.av.update(dt, { speed: 0, grounded: true, pose: 'idle' }); return true; }
    const step = Math.min(d, sp * dt);
    const nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
    if (inPlayground(nx, nz, 1)) { p.x = nx; p.z = nz; }
    n.yaw = Math.atan2(dx, dz);
    n.av.root.rotation.y = n.yaw;
    n.av.update(dt, { speed: sp, grounded: true, pose: 'idle' });
    return false;
  }

  update(dt) {
    const c = this.cur, g = this.g;
    if (!c || c.over) return;
    c.t = (performance.now() - c.start) / 1000 - c.G.count;
    const pos = g.player.pos;
    const left = Math.max(0, Math.ceil(c.t < 0 ? -c.t : c.G.duration - c.t));
    const [tb, sbx] = c.hud.querySelectorAll('b');
    tb.textContent = c.t < 0 ? `-${left}` : String(left);
    sbx.textContent = String(c.id === 'cachette' ? Math.max(0, Math.floor(c.t)) : c.found);
    for (const it of c.inters || []) { const n = c.npcs[c.inters.indexOf(it)]; it.x = n.av.root.position.x; it.z = n.av.root.position.z; }
    if (c.t >= 0 && !inPlayground(pos.x, pos.z, 6) && !c.outWarn) { c.outWarn = true; g.ui.toast('⚠️ Reste dans le parc des Tilleuls, sinon la partie s\'arrête !', 'bad', 3000); }
    if (c.t >= 0 && !inPlayground(pos.x, pos.z, 14)) { this.finish(false, 'Tu as quitté le parc.'); return; }
    for (const n of c.npcs) {
      if (n.state === 'out') { if (n.target) this.steer(n, dt, n.target.x, n.target.z, 2); continue; }
      if (n.state === 'count') { n.av.update(dt, { speed: 0, grounded: true, pose: 'idle' }); if (c.t >= 0) { n.state = 'seek'; this.say(n, pick(c.rand, LINES.seek)); } continue; }
      if (n.state === 'hide') { if (n.spot) this.steer(n, dt, n.spot.x, n.spot.z, n.speed); else n.av.update(dt, { speed: 0, grounded: true, pose: 'idle' }); }
      if (n.state === 'seek') {
        // le chercheur visite les cachettes ; il « sent » parfois la direction du joueur
        if (!n.target || this.steer(n, dt, n.target.x, n.target.z, 3.2)) {
          n.wait -= dt;
          if (n.wait <= 0) {
            const hunch = c.rand() < 0.3;
            n.target = hunch ? { x: pos.x + (c.rand() - 0.5) * 8, z: pos.z + (c.rand() - 0.5) * 8 } : pick(c.rand, c.spots.length ? c.spots : [{ x: P.x, z: P.z }]);
            n.wait = 1 + c.rand() * 1.5;
            n.yaw += Math.PI * (c.rand() - 0.5); // il regarde autour de lui
          }
        }
        for (const o of c.npcs) if (o !== n && o.state === 'hide' && !o.out && Math.hypot(o.av.root.position.x - n.av.root.position.x, o.av.root.position.z - n.av.root.position.z) < 2.2) { o.out = true; o.state = 'out'; o.target = { x: P.x + 8, z: P.z - P.d / 2 + 1 }; this.say(o, pick(c.rand, LINES.found)); }
        if (c.t > 1 && this.sees(n, pos)) { this.say(n, pick(c.rand, LINES.foundYou)); this.finish(false, `${n.name} t'a trouvé·e !`); return; }
      }
      if (c.id === 'cherche' && n.state === 'hide' && c.t >= 0) {
        // les malins changent de cachette quand tu approches
        const d = Math.hypot(pos.x - n.av.root.position.x, pos.z - n.av.root.position.z);
        if (n.smart && d < 6 && d > 2.8 && !n.moved) { n.moved = true; n.spot = pick(c.rand, c.spots); this.say(n, 'Oups, il faut que je bouge !'); }
      }
      if (n.state === 'run') {
        const p = n.av.root.position, dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz);
        if (c.t >= 0 && d < 1.3) { this.catch(n); continue; }
        let tx = p.x, tz = p.z;
        if (c.t >= 0 && d < 9) { tx = p.x + (dx / (d || 1)) * 5 + (c.rand() - 0.5) * 3; tz = p.z + (dz / (d || 1)) * 5 + (c.rand() - 0.5) * 3; if (!inPlayground(tx, tz, -1)) { tx = P.x + (c.rand() - 0.5) * P.w * 0.8; tz = P.z + (c.rand() - 0.5) * P.d * 0.8; } n.target = { x: tx, z: tz }; }
        else if (!n.target || c.rand() < 0.01) n.target = { x: P.x + (c.rand() - 0.5) * P.w * 0.8, z: P.z + (c.rand() - 0.5) * P.d * 0.8 };
        const tired = d > 9 && c.rand() < 0.002;
        if (tired) this.say(n, pick(c.rand, LINES.taunt));
        this.steer(n, dt, n.target.x, n.target.z, d < 9 ? n.speed : 1.6);
      }
    }
    if (c.t >= c.G.duration) this.finish(c.id === 'cachette');
  }

  async finish(won, why = '') {
    const g = this.g, c = this.cur;
    if (!c || c.over) return;
    c.over = true;
    const survived = Math.max(0, Math.floor(c.t));
    let r = null;
    try { r = await g.net.request('cour.finish', { survived }); } catch (e) { g.ui.toast(e.message, 'bad'); }
    setTimeout(() => { if (this.cur === c) this.cleanup(); }, 2500);
    if (why) g.ui.toast(why, won ? 'good' : 'bad', 3500);
    if (!r) return;
    g.sfx(r.won ? 'levelup' : 'success');
    if (r.won) g.fx.confetti(g.player.pos, 60);
    const m = g.ui.modal({
      title: `${c.G.emoji} ${r.won ? 'Gagné !' : 'Partie terminée'}`, sub: c.G.name,
      build: (b) => {
        b.append(h('div.stat-grid',
          h('div.stat', h('b', `${r.score}${c.id === 'cachette' ? ' s' : ''}`), h('span', c.id === 'cachette' ? 'Tenu' : c.id === 'loup' ? 'Touchés' : 'Trouvés')),
          h('div.stat', h('b', `+${fmt(r.coins)} PC`), h('span', 'Gagné')),
          h('div.stat', h('b', String(r.best)), h('span', r.record ? 'Nouveau record !' : 'Record')),
          h('div.stat', h('b', r.rank ? `#${r.rank}` : '—'), h('span', 'Classement'))));
        if (r.tournament?.length) b.append(h('p', '🏆 Score enregistré pour le tournoi en cours (résultats dans l\'Agenda à la fin).'));
        if (r.factor < 1) b.append(h('p.muted', `Tu as beaucoup joué cette heure-ci : récompense à ${Math.round(r.factor * 100)} %.`));
      },
      foot: (f) => f.append(h('button.btn.ghost', { onclick: () => m.close() }, 'Fermer'), h('button.btn', { onclick: () => { m.close(); this.cleanup(); this.start(c.id); } }, '↻ Rejouer')),
    });
  }

  cleanup() {
    const g = this.g, c = this.cur;
    if (!c) return;
    for (const n of c.npcs) { g.engine.scene.remove(n.av.root); g.labels.remove(n.lab); }
    for (const it of c.inters || []) g.interactions.remove(it);
    c.hud.remove();
    this.cur = null;
  }
}
void THREE;
