// Déco : poser des murs (pleine hauteur, porte praticable), déplacer un meuble déjà posé (bouton et touche M).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);

await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-m', name: 'Déco', createdAt: 0, coins: 900000, xp: 60000, rep: 0, appearance: {}, inventory: { canape: 1, 'mur-blanc': 1, 'mur-porte': 1 } })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=low');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);

// la boutique Brico vend les murs

await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['immo']; const g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(1.2); });
let r = await req('home.rent', { id: 'maison-t3' });
check(r.ok, `maison louée ${r.e || ''}`);
await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID['maison-t3']; const g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(1.2); });
await step(0.6);
check(await ev(() => window.playzone.home.canDecorate()), 'chez soi : on peut décorer');

// poser un mur plein, un mur avec porte et le canapé
for (const [id, dx] of [['mur-blanc', 0], ['mur-porte', -3.2], ['canape', 3]]) {
  await ev(([id, dx]) => { const g = window.playzone; const b = g.interiors.inside; g.player.teleport(b.x + dx, b.z, 0); g.debugStep(0.1); g.home.startGhost(id); g.debugStep(0.1); }, [id, dx]);
  await ev(() => window.playzone.home.confirmGhost());
  await sleep(400);
}
await step(0.8);
let p = await prof();
check(p.home.furniture.length === 3 && p.home.furniture.some((f) => f.i === 'mur-blanc'), `3 pièces posées (${p.home.furniture.map((f) => `${f.i}@${f.x},${f.z}`).join(' ')})`);

// le mur bloque : on marche droit dessus
const wall = p.home.furniture.findIndex((f) => f.i === 'mur-blanc');
const walk = async (idx, off) => ev(async ([idx, off]) => {
  const g = window.playzone, f = g.profile.home.furniture[idx], L = g.home.houseF.L;
  const [ax, az] = L(f.x + off, f.z - 1.6), [bx, bz] = L(f.x + off, f.z + 1.6);
  const yaw = Math.atan2(bx - ax, bz - az);
  // calibre la direction caméra → marche
  g.player.teleport(ax, az, yaw); g.cam.yaw = 0; g.debugStep(0.1);
  return { ax, az, bx, bz, yaw };
}, [idx, off]);
const proj = (w) => ev(([w]) => { const P = window.playzone.player.pos; const ux = w.bx - w.ax, uz = w.bz - w.az, n = Math.hypot(ux, uz); return ((P.x - w.ax) * ux + (P.z - w.az) * uz) / n; }, [w]);
const go = async (w, c, s) => {
  await ev(([w, c]) => { const g = window.playzone; g.player.teleport(w.ax, w.az, w.yaw); g.cam.yaw = c; g.debugStep(0.05); }, [w, c]);
  await page.keyboard.down('KeyW'); await step(s); await page.keyboard.up('KeyW');
};
// calibrage : dans quelle direction marche-t-on pour cam.yaw = 0 ?
let camFor = null;
const cross = async (idx, off) => {
  const w = await walk(idx, off);
  if (camFor === null) {
    await go(w, 0, 0.3);
    const phi = await ev(([w]) => { const P = window.playzone.player.pos; return Math.atan2(P.x - w.ax, P.z - w.az); }, [w]);
    let best = -1e9;
    for (const sg of [1, -1]) { const c = sg * (w.yaw - phi); await go(w, c, 0.3); const d = await proj(w); if (d > best) { best = d; camFor = (yaw) => sg * (yaw - phi); } }
  }
  await go(w, camFor(w.yaw), 2.5);
  return proj(w);
};
const prog = await cross(wall, 0);
check(prog < 1.6, `le mur bloque le passage (avance ${prog.toFixed(2)} m sur 3.2, mur à 1.6)`);
const door = p.home.furniture.findIndex((f) => f.i === 'mur-porte');
const prog2 = await cross(door, 0);
check(prog2 > 2.0, `on passe par la porte du mur (avance ${prog2.toFixed(2)} m)`);

// déplacer le canapé via le bouton (startGhost avec index)
const sofa = p.home.furniture.findIndex((f) => f.i === 'canape');
const before = { ...p.home.furniture[sofa] };
await ev(([k]) => { const g = window.playzone; const b = g.interiors.inside; g.player.teleport(b.x - 1, b.z + 2.5, 0); g.debugStep(0.1); g.home.startGhost(g.profile.home.furniture[k].i, k); g.home.rotateGhost(); g.debugStep(0.1); }, [sofa]);
check(await ev(() => { const g = window.playzone; return g.interiors.hideFurn != null && !g.interiors.homeView(g.interiors.inside).furniture.some((f) => f.i === 'canape'); }), 'l\'original est masqué pendant le déplacement');
await ev(() => window.playzone.home.confirmGhost());
await sleep(400); await step(0.5);
p = await prof();
const after = p.home.furniture[sofa];
check(p.home.furniture.length === 3 && after.i === 'canape' && (after.x !== before.x || after.z !== before.z) && after.r === ((before.r || 0) + 1) % 4, `canapé déplacé et tourné (${before.x},${before.z} → ${after.x},${after.z}, r=${after.r})`);

// touche M : déplace le meuble le plus proche
await ev(([k]) => { const g = window.playzone; const f = g.profile.home.furniture[k]; const [x, z] = g.home.houseF.L(f.x - 1, f.z); g.player.teleport(x, z, 0); g.debugStep(0.1); }, [sofa]);
await page.keyboard.press('KeyM'); await step(0.1);
const gh = await ev(() => { const gst = window.playzone.home.ghost; return gst && { id: gst.itemId, idx: gst.moveIndex }; });
check(gh?.id === 'canape' && gh.idx === sofa, `M prend le meuble le plus proche (${JSON.stringify(gh)})`);
await page.keyboard.press('Escape'); await step(0.1);
check(await ev(() => { const g = window.playzone; return !g.home.ghost && g.interiors.hideFurn == null && g.interiors.homeView(g.interiors.inside).furniture.length === 3; }), 'Échap annule, le meuble réapparaît');
await page.screenshot({ path: 'tests/e2e/out/meubles.png' });

const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'MEUBLES OK' : 'MEUBLES ÉCHEC');
process.exit(ok ? 0 : 1);
