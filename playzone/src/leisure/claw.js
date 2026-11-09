import { h, fmt } from '../ui/dom.js';
import { CLAW } from '../../shared/authority-athlete.js';

// JEU DE PINCE jouable : on déplace la pince (← → ou A / D, ou les boutons), on la lâche (Espace),
// elle descend, se referme, remonte... et peut lâcher la peluche en route ! Si elle arrive au-dessus
// du trou (à gauche), la peluche est gagnée. 20 secondes pour viser.
const W = 360, H = 420, CHUTE = { x: 8, w: 62 }, FLOOR = 372, TOP = 46;
const PRIZES = [
  { id: 'peluche-coeur', emoji: '🧸', r: 22, grip: 0.62, n: 6 },
  { id: 'peluche-poulet', emoji: '🐥', r: 30, grip: 0.38, n: 3 },
  { id: 'ticket', emoji: '💎', r: 14, grip: 0.3, n: 2 },
];

export function openClaw(g, b) {
  if (g._claw) return;
  const cv = h('canvas', { width: W, height: H, style: { width: '100%', maxWidth: `${W}px`, borderRadius: '16px', background: '#100c22', display: 'block', margin: '0 auto' } });
  const x = cv.getContext('2d');
  let s = null;   // partie en cours
  const info = h('div.d', { style: { textAlign: 'center', margin: '6px 0' } }, `Une partie : ${fmt(CLAW.price)} PC. ← → pour viser, ESPACE pour lâcher la pince.`);
  const btn = (label, on, off) => h('button.btn.small', { onpointerdown: (e) => { e.preventDefault(); on(); }, onpointerup: () => off?.(), onpointerleave: () => off?.() }, label);
  const hold = { l: false, r: false };
  const playBtn = h('button.btn', { onclick: () => start() }, `🕹️ Jouer (${fmt(CLAW.price)} PC)`);
  const m = g.ui.modal({
    title: '🕹️ Jeu de pince', sub: 'Attrape une peluche et lâche-la dans le trou !', width: 'min(420px, 96vw)',
    onClose: () => { alive = false; g.clawGame = null; removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true); g._claw = null; if (s && !s.done) g.net.request('claw.end', { prize: null }).catch(() => {}); },
    build: (body) => body.append(cv, info, h('div.row', { style: { justifyContent: 'center', gap: '8px' } }, btn('◀', () => { hold.l = true; }, () => { hold.l = false; }), btn('⬇️ Lâcher', () => drop()), btn('▶', () => { hold.r = true; }, () => { hold.r = false; })), h('div', { style: { textAlign: 'center', marginTop: '8px' } }, playBtn)),
  });
  g._claw = m;
  let alive = true;
  // tas de peluches (positions aléatoires au fond)
  let pile = [];
  const fill = () => { pile = []; for (const P of PRIZES) for (let k = 0; k < P.n; k++) pile.push({ ...P, x: CHUTE.x + CHUTE.w + 30 + Math.random() * (W - CHUTE.w - 70), y: FLOOR - P.r - Math.random() * 18 }); };
  fill();
  const kd = (e) => { if (!s) return; if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') { hold.l = true; e.preventDefault(); } if (e.code === 'ArrowRight' || e.code === 'KeyD') { hold.r = true; e.preventDefault(); } if (e.code === 'Space') { drop(); e.preventDefault(); e.stopPropagation(); } };
  const ku = (e) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') hold.l = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') hold.r = false; };
  addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);

  async function start() {
    if (s && !s.done) return;
    try { const r = await g.net.request('claw.start', {}); if (r.cost) g.sfx('cash'); }
    catch (e) { g.ui.toast(e.message, 'bad'); g.sfx('error'); return; }
    if (pile.length < 5) fill();
    s = { cx: W / 2, cy: TOP, phase: 'aim', t: 20, open: 1, held: null, done: false };
    playBtn.disabled = true;
    info.textContent = 'Vise avec ← → puis ESPACE pour lâcher ! (20 s)';
    g.sfx('beep');
  }
  function drop() { if (s && s.phase === 'aim') { s.phase = 'down'; g.sfx('click'); } }
  async function finish(prize) {
    s.done = true; playBtn.disabled = false;
    try {
      const r = await g.net.request('claw.end', { prize });
      if (r.prize) { g.sfx('levelup'); info.textContent = `🎉 GAGNÉ : ${r.name} !`; g.ui.toast(`🕹️ Gagné : ${r.name} !${r.prize === 'peluche-coeur' ? ' Offre-la à quelqu\'un que tu aimes 💕' : r.prize === 'ticket' ? ' +120 PC' : ' Installe-la chez toi.'}`, 'good', 4500); }
      else { g.sfx('fail'); info.textContent = 'Raté ! La pince a tout lâché... Rejoue !'; }
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  let last = performance.now();
  const loop = (now) => {
    if (!alive) return;
    // pas fixes en temps réel : la pince garde la même vitesse même si l'écran rame
    let acc = Math.min(0.5, (now - last) / 1000); last = now;
    while (acc > 1e-4 && s && !s.done) { const dt = Math.min(1 / 60, acc); step(dt); acc -= dt; }
    draw(now / 1000);
    requestAnimationFrame(loop);
  };
  // filet de sécurité si requestAnimationFrame est ralenti (onglet en arrière-plan)
  const tick = setInterval(() => { if (!alive) clearInterval(tick); else if (performance.now() - last > 120) loop(performance.now()); }, 100);
  function step(dt) {
    if (s.phase === 'aim') {
      s.t -= dt;
      s.cx = Math.max(30, Math.min(W - 24, s.cx + ((hold.r ? 1 : 0) - (hold.l ? 1 : 0)) * 150 * dt));
      if (s.t <= 0) drop();
    } else if (s.phase === 'down') {
      s.cy += 170 * dt;
      // touche une peluche ou le fond
      const under = pile.filter((p) => Math.abs(p.x - s.cx) < p.r + 6).sort((a, c) => a.y - c.y)[0];
      const stop = under ? under.y - under.r - 6 : FLOOR - 12;
      if (s.cy >= stop) { s.cy = stop; s.phase = 'close'; s.timer = 0.5; s.target = under; }
    } else if (s.phase === 'close') {
      s.open = Math.max(0, s.open - 3 * 0.016 * 60 * dt); s.timer -= dt;
      if (s.timer <= 0) {
        const p = s.target;
        // prise : meilleure si la pince est bien centrée sur la peluche
        if (p) { const align = 1 - Math.min(1, Math.abs(p.x - s.cx) / (p.r + 4)); if (Math.random() < p.grip * (0.45 + align * 0.75)) { s.held = p; pile.splice(pile.indexOf(p), 1); g.sfx('pop'); } }
        s.phase = 'up';
      }
    } else if (s.phase === 'up') {
      s.cy -= 120 * dt;
      // la pince peut lâcher en remontant (comme les vraies !)
      if (s.held && Math.random() < dt * (0.35 - s.held.grip * 0.3)) { s.held.x = s.cx; s.held.y = s.cy + s.held.r; s.held.vy = 0; s.falling = s.held; s.held = null; g.sfx('click'); }
      if (s.cy <= TOP) { s.cy = TOP; s.phase = s.held ? 'home' : 'end'; }
    } else if (s.phase === 'home') {
      s.cx -= 140 * dt;
      if (s.held && Math.random() < dt * 0.12) { s.held.x = s.cx; s.held.y = s.cy + s.held.r; s.held.vy = 0; s.falling = s.held; s.held = null; g.sfx('click'); }
      if (s.cx <= CHUTE.x + CHUTE.w / 2) { s.cx = CHUTE.x + CHUTE.w / 2; s.open = 1; if (s.held) { const won = s.held; s.held = null; s.phase = 'win'; s.win = won; s.wy = s.cy; } else s.phase = 'end'; }
    } else if (s.phase === 'win') {
      s.wy += 260 * dt;
      if (s.wy > H) { s.phase = 'over'; finish(s.win.id); }
    } else if (s.phase === 'end') { s.phase = 'over'; finish(null); }
    // peluche qui retombe
    if (s.falling) { const f = s.falling; f.vy = (f.vy || 0) + 900 * dt; f.y += f.vy * dt; if (f.y >= FLOOR - f.r) { f.y = FLOOR - f.r; pile.push(f); s.falling = null; } }
    if (s.phase !== 'aim' && s.phase !== 'close') s.open = s.phase === 'down' ? 1 : s.open;
  }
  function draw(t) {
    x.clearRect(0, 0, W, H);
    // vitrine
    const grd = x.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#2a1b5e'); grd.addColorStop(1, '#0d0820'); x.fillStyle = grd; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) { x.fillStyle = `hsla(${(i * 26 + t * 60) % 360},90%,60%,0.9)`; x.beginPath(); x.arc(14 + i * 25, 14, 5, 0, 7); x.fill(); }
    x.fillStyle = '#05030c'; x.fillRect(CHUTE.x, FLOOR - 40, CHUTE.w, 60); x.strokeStyle = '#ffd23f'; x.lineWidth = 3; x.strokeRect(CHUTE.x, FLOOR - 40, CHUTE.w, 60);
    x.fillStyle = '#ffd23f'; x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.fillText('SORTIE', CHUTE.x + CHUTE.w / 2, FLOOR - 46);
    x.fillStyle = '#3d2b80'; x.fillRect(CHUTE.x + CHUTE.w, FLOOR, W - CHUTE.w, H - FLOOR);
    // peluches
    x.textBaseline = 'middle';
    for (const p of pile) { x.font = `${p.r * 2}px serif`; x.fillText(p.emoji, p.x, p.y); }
    if (s?.falling) { x.font = `${s.falling.r * 2}px serif`; x.fillText(s.falling.emoji, s.falling.x, s.falling.y); }
    // pince
    const cx = s ? s.cx : W / 2, cy = s ? (s.phase === 'win' ? TOP : s.cy) : TOP, open = s ? s.open : 1;
    x.strokeStyle = '#c0c0c8'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, 30); x.lineTo(cx, cy); x.stroke();
    x.fillStyle = '#9aa0a6'; x.fillRect(cx - 12, cy - 6, 24, 10);
    x.lineWidth = 4; x.strokeStyle = '#d9d9e0';
    for (const sgn of [-1, 1]) { x.beginPath(); x.moveTo(cx + sgn * 8, cy + 4); x.lineTo(cx + sgn * (10 + open * 14), cy + 22); x.lineTo(cx + sgn * (4 + open * 10), cy + 34); x.stroke(); }
    if (s?.held) { x.font = `${s.held.r * 2}px serif`; x.fillText(s.held.emoji, cx, cy + 28); }
    if (s?.phase === 'win') { x.font = `${s.win.r * 2}px serif`; x.fillText(s.win.emoji, CHUTE.x + CHUTE.w / 2, s.wy); }
    // chrono
    if (s?.phase === 'aim') { x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.textAlign = 'right'; x.fillText(`${Math.ceil(s.t)} s`, W - 10, 40); x.textAlign = 'center'; }
    // reflets de la vitre
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.beginPath(); x.moveTo(W * 0.62, 0); x.lineTo(W * 0.8, 0); x.lineTo(W * 0.5, H); x.lineTo(W * 0.32, H); x.fill();
  }
  requestAnimationFrame(loop);
  const api = { start, drop, get state() { return s; }, hold, close: () => m.close() };
  g.clawGame = api;
  return api;
}
