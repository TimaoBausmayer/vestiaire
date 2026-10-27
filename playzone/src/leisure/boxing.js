import { h, fmt } from '../ui/dom.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE } from '../../shared/appearance.js';
import { BOX, OPPONENTS, OPP_BY_ID, defaultBoxing, jabDmg, hookDmg } from '../../shared/boxing.js';

// CLUB DE BOXE : séries au sac de frappe et combats d'entraînement sur le ring contre 10 boxeurs PNJ.
// G = direct (alterne gauche / droite), H = crochet (lent, puissant), B (maintenu) = garde.
// L'adversaire prévient avant de frapper (❗) : garde, ou recule hors de portée. 3 rounds ou KO.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const req = async (g, t, p) => { try { return await g.net.request(t, p); } catch (e) { g.ui.toast(e.message, 'bad', 4000); g.sfx('error'); return null; } };

export class Boxing {
  constructor(g) {
    this.g = g;
    this.f = null;      // combat en cours
    this.bagS = null;   // série au sac en cours
    g.input.on('key', (e) => {
      if (this.f?.phase === 'fight') { if (e.code === 'KeyG') this.punch('jab'); else if (e.code === 'KeyH') this.punch('hook'); }
      else if (this.bagS) { if (e.code === 'KeyG' || e.code === 'KeyH' || e.code === 'Space') this.bagHit(e.code === 'KeyH'); }
    });
  }

  get busy() { return !!(this.f || this.bagS); }
  rec() { return { ...defaultBoxing(), ...(this.g.profile.sports?.boxing || {}) }; }

  // ------------------------------------------------------------------ coach : palmarès et adversaires
  menu(ring) {
    const g = this.g, B = this.rec();
    if (this.busy) return;
    const m = g.ui.modal({
      title: '🥊 Club de boxe', width: 'min(600px, 96vw)',
      sub: `Palmarès : ${B.wins} victoire${B.wins > 1 ? 's' : ''} (${B.kos} KO) · ${B.losses} défaite${B.losses > 1 ? 's' : ''}. Chaque combat coûte ${BOX.session} PC (frais de ring). Bats chaque boxeur pour affronter le suivant !`,
      build: (body) => {
        body.append(h('p.muted', 'Commandes : G = direct · H = crochet · B (maintenu) = garde · déplace-toi pour esquiver. Quand l\'adversaire lève le poing (❗), garde ou recule ! Ta force dépend de tes muscles (salle de sport, sac de frappe).'));
        OPPONENTS.forEach((o, i) => {
          const locked = i > B.beaten + 1 && !g.profile.admin, done = i <= B.beaten;
          body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, done ? '✅' : locked ? '🔒' : '🥊'),
            h('div.grow', h('div.t', `${i + 1}. ${o.name}`), h('div.d', `Vie ${o.hp} · frappe ${o.dmg} · vitesse ${o.speed} · prime ${fmt(o.prize)} PC${done ? ' (revanche : 40 %)' : ''}`)),
            h('button.btn.small', { disabled: locked || !ring, onclick: () => { m.close(); this.fight(ring, o.id); } }, locked ? 'Verrouillé' : 'Combattre')));
        });
      },
    });
  }

  // ------------------------------------------------------------------ sac de frappe
  bag() {
    const g = this.g;
    if (this.busy) return;
    const s = this.bagS = { hits: 0, t: 0, last: 0, alt: false };
    s.el = h('div.box-bag', h('b', '🥊 Sac de frappe'), h('div.box-count', '0'), h('small', 'Tape vite : G (ou H, Espace, bouton 👊) !'));
    s.btn = h('div.foot-btns', h('button', { onpointerdown: (e) => { e.preventDefault(); this.bagHit(false); } }, '👊 Frapper'));
    g.ui.root.append(s.el, s.btn);
    g.ui.toast(`🥊 ${BOX.bagSeconds} secondes : enchaîne les coups !`, 'good', 2500);
  }

  bagHit(hook) {
    const s = this.bagS, g = this.g;
    if (!s) return;
    if (s.t - s.last < 0.12) return;   // pas plus de ~8 coups par seconde
    s.last = s.t; s.alt = !s.alt; s.hits++;
    g.player.setPose(hook ? 'hook' : s.alt ? 'jab' : 'jabL', 0.22);
    g.sfx('bump');
    s.el.querySelector('.box-count').textContent = s.hits;
  }

  async endBag() {
    const s = this.bagS, g = this.g;
    this.bagS = null;
    s.el.remove(); s.btn.remove();
    g.player.setPose('idle');
    const r = await req(g, 'boxing.bag', { hits: s.hits });
    if (!r) return;
    g.emit('needs', r.needs); g.sfx('success');
    g.ui.toast(`🥊 ${s.hits} coups ! 💪 Muscles +${r.muscle.toFixed(2)} (${Math.round(r.total)}/100) · endurance +${r.endurance.toFixed(2)} · +${r.xp} XP`, 'good', 5000);
  }

  // ------------------------------------------------------------------ combat sur le ring
  async fight(ring, oppId) {
    const g = this.g, O = OPP_BY_ID[oppId];
    if (this.busy || !O) return;
    const r = await req(g, 'boxing.start', { opp: oppId });
    if (!r) return;
    const c = Math.cos(ring.th), sn = Math.sin(ring.th);
    const L = (lx, lz) => ({ x: ring.x + lx * c + lz * sn, z: ring.z - lx * sn + lz * c });   // repère du ring
    const av = new Avatar({ ...DEFAULT_APPEARANCE, skin: pick(['#8d5524', '#f1c27d', '#c68642', '#ffdbac', '#e0ac69']), hair: pick(['court', 'chauve', 'herisse', 'crete']), top: 'debardeur', topColor: O.color, bottom: 'short', bottomColor: '#14141c' }, {});
    av.gloves(O.color === '#d4a017' ? '#d4a017' : '#d00000');
    g.engine.scene.add(av.root);
    const label = g.labels.add(av.root, h('div.wlabel', O.name), 2.3, 30);
    g.avatar.gloves('#1d4ed8');
    const P = g.player;
    const f = this.f = { ring, L, O, av, label, ohp: O.hp, php: BOX.playerHp, st: 1, round: 1, t: BOX.roundSec, phase: 'intro', pt: 2, cd: 0, alt: false, next: 2.5, atk: null, oGuard: 0, oHit: 0, combo: 0, landed: 0 };
    const a = L(0, ring.half * 0.6), b = L(0, -ring.half * 0.6);
    f.o = { x: b.x, z: b.z, yaw: 0 };
    P.teleport(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z), ring.y);
    P.noJump = true;
    this.saved = { dist: g.cam.dist, pitch: g.cam.pitch };
    g.cam.dist = 5.5; g.cam.pitch = 0.32;
    // affichage : barres de vie, endurance, round, boutons
    f.hud = h('div.box-hud',
      h('div.box-side', h('b', g.profile.name), h('div.box-bar', h('i.me')), h('div.box-bar.st', h('i.st'))),
      h('div.box-mid', h('b.box-round', 'ROUND 1'), h('div.box-time', '')),
      h('div.box-side.r', h('b', O.name), h('div.box-bar', h('i.op'))));
    f.btns = h('div.foot-btns.box-btns',
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.punch('jab'); } }, '👊 Direct (G)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.punch('hook'); } }, '💥 Crochet (H)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.guardBtn = true; }, onpointerup: () => { this.guardBtn = false; }, onpointerleave: () => { this.guardBtn = false; } }, '🛡️ Garde (B)'),
      h('button', { onpointerdown: (e) => { e.preventDefault(); this.finish(false, false, true); } }, '🏳️ Abandon'));
    f.flash = h('div.box-flash');
    g.ui.root.append(f.hud, f.btns, f.flash);
    g.sfx('whistle');
    this.announce(`🥊 ${O.name} — ROUND 1`);
  }

  announce(text) { this.g.ui.toast(text, 'good', 1800); }

  punch(kind) {
    const f = this.f, g = this.g;
    if (!f || f.phase !== 'fight' || f.cd > 0) return;
    const P = g.player, hook = kind === 'hook', cost = hook ? 0.24 : 0.1;
    const weak = f.st < cost;
    f.st = Math.max(0, f.st - cost);
    f.cd = hook ? 0.62 : 0.32;
    f.alt = !f.alt;
    const dx = f.o.x - P.pos.x, dz = f.o.z - P.pos.z, d = Math.hypot(dx, dz);
    P.yaw = Math.atan2(dx, dz);
    P.setPose(hook ? 'hook' : f.alt ? 'jab' : 'jabL', hook ? 0.32 : 0.2);
    if (d > (hook ? 1.45 : 1.6)) { g.sfx('throw'); return; }   // dans le vide
    const muscle = g.profile.body?.muscle ?? 30;
    let dmg = (hook ? hookDmg(muscle) : jabDmg(muscle)) * (0.85 + Math.random() * 0.3) * (weak ? 0.45 : 1);
    if (f.oGuard > 0 || (!hook && Math.random() < f.O.guard)) {   // paré
      dmg *= 0.2; g.sfx('click');
      if (f.oGuard <= 0) { f.oGuard = 0.5; }
    } else {
      g.sfx('bump'); f.landed++; f.combo++;
      f.oHit = 0.28;
      g.fx?.emit?.({ x: f.o.x, y: f.ring.y + 1.6, z: f.o.z, n: hook ? 14 : 7, colors: ['#ffffff', '#ffd23f', '#ff6b6b'], speed: 2.5, gravity: 4, life: 0.5, size: 0.08 });
      if (f.combo >= 3 && Math.random() < 0.5) f.oGuard = 0.8;   // il se referme après une série
    }
    f.ohp = Math.max(0, f.ohp - dmg);
    if (f.ohp <= 0) this.ko(true);
  }

  ko(playerWins) {
    const f = this.f, g = this.g;
    f.phase = 'end'; f.pt = 3;
    if (playerWins) { f.av.update(0.1, { pose: 'down', grounded: true }); f.downO = true; g.sfx('levelup'); this.announce('💥 K.O. ! Victoire !'); g.player.setPose('celebrate', 2.5); }
    else { f.downP = true; g.sfx('fail'); this.announce('😵 K.O. ... tu as perdu.'); }
    f.result = { won: playerWins, ko: true };
  }

  async finish(won, ko, abandon = false) {
    const f = this.f, g = this.g;
    if (!f) return;
    this.f = null;
    f.av.root.removeFromParent(); g.labels.remove?.(f.label);
    f.hud.remove(); f.btns.remove(); f.flash.remove();
    g.avatar.gloves(null);
    g.player.noJump = false; g.player.setPose('idle');
    if (this.saved) { g.cam.dist = this.saved.dist; g.cam.pitch = this.saved.pitch; }
    const off = f.L(0, f.ring.half + 2.2);
    g.player.teleport(off.x, off.z, g.player.yaw);
    const r = await req(g, 'boxing.end', { won: !!won && !abandon, ko: !!ko });
    if (!r) return;
    if (r.needs) g.emit('needs', r.needs);
    if (r.won) {
      g.reward?.({ coins: 0, xp: 0 });
      g.ui.dialog({ name: 'Coach', role: 'Club de boxe', text: `${ko ? '💥 Victoire par K.O. !' : '🏆 Victoire aux points !'} Prime : ${fmt(r.prize)} PC, +${r.xp} XP.${r.first ? ' Prochain adversaire débloqué !' : ''}`, choices: [{ label: '💪 Trop fort !', ghost: true, action: (m) => m.close() }] });
    } else g.ui.dialog({ name: 'Coach', role: 'Club de boxe', text: abandon ? 'Abandon... On remet ça quand tu veux. Travaille au sac !' : pick(['Tu as perdu, mais tu as appris. Garde haute, la prochaine fois !', 'Pas grave ! Plus de muscles (salle, sac de frappe) et tu le battras.']), choices: [{ label: 'D\'accord', ghost: true, action: (m) => m.close() }] });
  }

  // ------------------------------------------------------------------ boucle
  update(dt) {
    const g = this.g;
    if (this.bagS) { this.bagS.t += dt; if (this.bagS.t >= BOX.bagSeconds) this.endBag(); }
    const f = this.f;
    if (!f) return;
    const P = g.player, O = f.O, I = g.input;
    f.cd = Math.max(0, f.cd - dt); f.oGuard = Math.max(0, f.oGuard - dt); f.oHit = Math.max(0, f.oHit - dt);
    // abandon si on quitte le ring (porte, téléportation...)
    if (Math.hypot(P.pos.x - f.ring.x, P.pos.z - f.ring.z) > f.ring.half + 6) { this.finish(false, false, true); return; }
    // on reste entre les cordes
    const c = Math.cos(f.ring.th), s = Math.sin(f.ring.th);
    const inRing = (p) => { const dx = p.x - f.ring.x, dz = p.z - f.ring.z; let u = dx * c - dz * s, v = dx * s + dz * c; u = clamp(u, -f.ring.half, f.ring.half); v = clamp(v, -f.ring.half, f.ring.half); p.x = f.ring.x + u * c + v * s; p.z = f.ring.z - u * s + v * c; };
    inRing(P.pos);
    const guarding = I.keys.has('KeyB') || this.guardBtn;
    if (P.pose === 'idle' || P.pose === 'guard') P.pose = guarding ? 'guard' : 'idle';
    f.st = Math.min(1, f.st + dt * (guarding ? 0.15 : 0.3));
    const dx = P.pos.x - f.o.x, dz = P.pos.z - f.o.z, d = Math.hypot(dx, dz);
    let oPose = f.oHit > 0 ? 'hit' : f.oGuard > 0 ? 'guard' : 'guard', oSpeed = 0;
    f.o.yaw = Math.atan2(dx, dz);
    if (f.phase === 'intro' || f.phase === 'break') {
      f.pt -= dt;
      if (f.pt <= 0) { f.phase = 'fight'; g.sfx('go'); if (f.round > 1) this.announce(`🔔 ROUND ${f.round}`); }
    } else if (f.phase === 'fight') {
      f.t -= dt;
      // IA : avance, tourne autour, attaque en prévenant
      if (!f.atk) {
        if (d > 1.3) { const sp = 1.7 * O.speed; f.o.x += (dx / d) * sp * dt; f.o.z += (dz / d) * sp * dt; oSpeed = sp; }
        else if (d < 0.95) { f.o.x -= (dx / d) * dt; f.o.z -= (dz / d) * dt; }
        else { const side = Math.sin(performance.now() / 900) > 0 ? 1 : -1; f.o.x += (-dz / d) * side * 0.6 * dt; f.o.z += (dx / d) * side * 0.6 * dt; oSpeed = 0.6; }
        f.next -= dt;
        if (f.next <= 0 && d < 2.2) {
          const hook = Math.random() < 0.3;
          f.atk = { hook, t: (hook ? 0.62 : 0.42) / Math.sqrt(O.speed) };
          g.labels.bubble(f.av.root, hook ? '‼️' : '❗', 600, '', 2.4);
        }
      } else {
        f.atk.t -= dt;
        oPose = 'guard';
        if (f.atk.t <= 0) {
          const hook = f.atk.hook;
          f.atk = null; f.next = (1.1 + Math.random() * 1.0) / O.speed;
          f.oStrike = 0.25; f.oStrikeHook = hook; f.oAlt = !f.oAlt;
          if (d <= 1.7) {
            let dmg = O.dmg * (hook ? 1.6 : 1) * (0.85 + Math.random() * 0.3);
            if (guarding) { dmg *= 0.15; g.sfx('click'); } else { g.sfx('bump'); P.setPose('hit', 0.3); f.flash.classList.remove('on'); void f.flash.offsetWidth; f.flash.classList.add('on'); }
            if (g.profile.admin) dmg = 0;   // l'admin n'est jamais blessé
            f.php = Math.max(0, f.php - dmg);
            f.combo = 0;
            if (f.php <= 0) this.ko(false);
          } else g.sfx('throw');
        }
      }
      if (f.oStrike > 0) { f.oStrike -= dt; oPose = f.oStrikeHook ? 'hook' : f.oAlt ? 'jab' : 'jabL'; }
      if (f.phase === 'fight' && f.t <= 0) {
        if (f.round >= BOX.rounds) { f.phase = 'end'; f.pt = 2.5; const won = f.php / BOX.playerHp > f.ohp / O.hp; f.result = { won, ko: false }; g.sfx('whistle'); this.announce(won ? '🏆 Victoire aux points !' : '❌ Défaite aux points...'); }
        else { f.round++; f.t = BOX.roundSec; f.phase = 'break'; f.pt = 4; f.php = Math.min(BOX.playerHp, f.php + 12); f.ohp = Math.min(O.hp, f.ohp + O.hp * 0.08); f.st = 1; g.sfx('whistle'); this.announce('🔔 Fin du round : souffle un peu...'); }
      }
    } else if (f.phase === 'end') {
      f.pt -= dt;
      if (f.pt <= 0) { const res = f.result; this.finish(res.won, res.ko); return; }
    }
    inRing(f.o);
    // rendu de l'adversaire
    f.av.root.position.set(f.o.x, f.ring.y + (f.downO ? 0.55 : 0), f.o.z);   // au tapis : posé sur le plancher du ring
    f.av.root.rotation.y = f.o.yaw;
    if (f.downO) { f.av.update(dt, { pose: 'down', grounded: true }); }
    else f.av.update(dt, { speed: oSpeed, grounded: true, pose: oPose });
    if (f.downP) P.setPose('down', 1);
    // affichage
    f.hud.querySelector('i.me').style.width = `${(f.php / BOX.playerHp) * 100}%`;
    f.hud.querySelector('i.st').style.width = `${f.st * 100}%`;
    f.hud.querySelector('i.op').style.width = `${(f.ohp / O.hp) * 100}%`;
    f.hud.querySelector('.box-round').textContent = f.phase === 'break' ? 'PAUSE' : `ROUND ${f.round}/${BOX.rounds}`;
    f.hud.querySelector('.box-time').textContent = `${Math.max(0, Math.ceil(f.t))} s`;
  }
}
