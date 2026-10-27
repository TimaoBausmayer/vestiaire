// Jardin derrière la maison (meubles d'extérieur), baignade dans sa piscine (détente), sortie de l'eau.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-j', name: 'Jardinier', createdAt: 0, coins: 900000, xp: 60000, rep: 0, appearance: {}, inventory: { piscine: 1, hamac: 1, palmier: 1 } })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=low');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
const req = (type, payload) => ev(([t, p]) => window.playzone.net.request(t, p).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e: e.message })), [type, payload]);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const step = (s) => ev(([s]) => window.playzone.debugStep(s), [s]);
const toLocal = (lx, lz, yaw = 0) => ev(async ([lx, lz, yaw]) => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const { buildingFrame } = await import('/src/world/buildings.js'); const F = buildingFrame(BUILDING_BY_ID['maison-t3']); const [x, z] = F.L(lx, lz); const g = window.playzone; g.player.teleport(x, z, F.th + yaw); g.debugStep(0.3); }, [lx, lz, yaw]);

await ev(async () => { const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const b = BUILDING_BY_ID.immo; const g = window.playzone; g.player.teleport(b.x, b.z, 0); g.debugStep(1.2); });
let r = await req('home.rent', { id: 'maison-t3' });
check(r.ok, `maison louée ${r.e || ''}`);
const G = await ev(async () => (await import('/shared/property.js')).gardenOf('maison-t3'));
check(G && G.depth >= 3, `la maison a un jardin derrière (${JSON.stringify(G)})`);

// dans le jardin : on peut décorer
await toLocal(0, (G.z1 + G.z2) / 2 + 1.2, Math.PI);
await step(0.5);
const st = await ev(() => { const h = window.playzone.home; return { inGarden: h.inGarden, deco: h.canDecorate(), btn: !!h.decoBtn }; });
check(st.inGarden && st.deco && st.btn, `dans le jardin : bouton Décorer (${JSON.stringify(st)})`);
for (const [id, lx] of [['piscine', 0], ['hamac', -3.2]]) {
  await toLocal(lx, (G.z1 + G.z2) / 2 + 1.2, Math.PI);
  await ev(([id]) => { const g = window.playzone; g.home.startGhost(id); g.debugStep(0.1); }, [id]);
  await ev(() => window.playzone.home.confirmGhost());
  await sleep(400);
}
await step(0.6);
let p = await prof();
const pool = p.home.furniture.find((f) => f.i === 'piscine');
check(p.home.furniture.length === 2 && pool && pool.z < -G.D / 2, `piscine et hamac posés dans le jardin (${p.home.furniture.map((f) => `${f.i}@${f.x},${f.z}`).join(' ')})`);
// hors de la maison et du jardin : refusé par le serveur
r = await req('home.place', { itemId: 'palmier', x: 0, z: G.z1 - 3, r: 0 });
check(!r.ok, `impossible de poser au-delà du jardin (${r.e})`);

// se baigner
await toLocal(4, G.z1 + 1, 0);
await ev(() => { const g = window.playzone; g.cam.dist = 11; g.cam.pitch = 0.55; g.cam.yaw = g.player.yaw + Math.PI + 0.6; g.debugStep(0.6); });
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/jardin.png' });
const hum0 = (await prof()).needs.humeur ?? 0;
const used = await ev(async () => { const g = window.playzone; const it = [...g.interiors.loaded.get('maison-t3').inters].find((i) => /baigner/.test(typeof i.label === 'function' ? i.label() : i.label)); if (!it) return null; const x = typeof it.x === 'function' ? it.x() : it.x, z = typeof it.z === 'function' ? it.z() : it.z; g.player.teleport(x, z, 0); g.debugStep(0.2); await it.action(); return true; });
check(used, 'on trouve « Se baigner » à côté de la piscine');
await sleep(400);
for (let i = 0; i < 6; i++) await step(0.2);
const sw = await ev(() => { const P = window.playzone.player; return { pool: !!P.pool, swimming: P.swimming, y: P.pos.y }; });
check(sw.pool && sw.swimming && sw.y < 0.5, `on nage dans la piscine (${JSON.stringify(sw)})`);
p = await prof();
check((p.needs.humeur ?? 0) > hum0 || p.needs.humeur >= 99, `ça détend : humeur ${Math.round(hum0)} → ${Math.round(p.needs.humeur)}`);
// on nage : on reste dans le bassin
await page.keyboard.down('KeyW'); await step(2); await page.keyboard.up('KeyW');
const inside = await ev(() => { const g = window.playzone, P = g.player, pl = P.pool; const dx = P.pos.x - pl.cx, dz = P.pos.z - pl.cz; const c = Math.cos(pl.a), s = Math.sin(pl.a); return Math.abs(dx * c - dz * s) <= pl.hx + 0.01 && Math.abs(dx * s + dz * c) <= pl.hz + 0.01; });
check(inside, 'on nage sans sortir du bassin');
await page.screenshot({ path: 'tests/e2e/out/jardin-piscine.png' });
await page.keyboard.press('Space'); await step(0.3);
const outSt = await ev(() => { const P = window.playzone.player; return { pool: !!P.pool, swimming: P.swimming }; });
check(!outSt.pool && !outSt.swimming, `Espace : on sort de l'eau (${JSON.stringify(outSt)})`);
r = await req('home.use', { what: 'swim' });
check(!r.ok, `petite pause entre deux baignades (${r.e})`);

const errs = errors.filter((e) => !/404/.test(e));
check(!errs.length, `pas d'erreur console ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); srv.close();
console.log(ok ? 'JARDIN OK' : 'JARDIN ÉCHEC');
process.exit(ok ? 0 : 1);
