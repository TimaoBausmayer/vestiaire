// Karting : accueil du circuit (formules, prix), session d'entraînement chronométrée (tours validés),
// course du jour : feux de départ, grille de pilotes PNJ, classement final et prix.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-k', name: 'Pilote', createdAt: 0, coins: 5000, xp: 1500, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo&qualite=medium');
await sleep(4500);
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };
const prof = () => ev(() => window.playzone.profile);
const toDesk = () => ev(async () => {
  const { BUILDING_BY_ID } = await import('/shared/world-layout.js'); const g = window.playzone; const b = BUILDING_BY_ID['circuit-stand'];
  g.player.teleport(b.x, b.z, 0); for (let i = 0; i < 40 && !g.interiors.loaded.has(b.id); i++) g.debugStep(0.3);
  const d = g.interiors.loaded.get(b.id).inters.find((x) => /Accueil du karting/.test(x.label)); g.player.teleport(d.x, d.z, 0); g.debugStep(0.3); return g.interactions.label();
});
// fait rouler le kart sur `laps` tours de `sec` secondes (temps simulé)
const drive = (laps, sec) => ev(async ([laps, sec]) => {
  const g = window.playzone, K = g.karting, v = K.s.v;
  const { GATES, trackAt, TRACK_LENGTH } = await import('/shared/karting.js');
  const real = Date.now; let fake = Math.max(real(), (K.s.green || 0) + 200, window.__fakeT || 0); Date.now = () => fake;
  try {
    const steps = 32;
    for (let l = 0; l < laps; l++) for (let i = 0; i <= steps; i++) {
      const p = trackAt((i / steps) * TRACK_LENGTH);
      v.sim.place(p.x, p.z, p.yaw);
      fake += (sec * 1000) / steps;
      g.debugStep(1 / 15);
      g.net.sendState({ x: p.x, y: 0, z: p.z }, 'world');
    }
  } finally { window.__fakeT = fake; Date.now = real; }
  void GATES;
  return K.s ? K.s.laps.length : -1;
}, [laps, sec]);

// 1) accueil et formules
check(/Accueil du karting/.test(await toDesk() || ''), 'accueil du karting dans le stand du circuit');
await page.keyboard.press('KeyE'); await sleep(500);
const txt = await page.locator('.modal').last().textContent();
check(/Entraînement 10 min/.test(txt) && /PC/.test(txt), 'formules et prix affichés');
await page.screenshot({ path: 'tests/e2e/out/kart-accueil.png' });
const c0 = (await prof()).coins;
await page.locator('.list-item', { hasText: 'Entraînement 10 min' }).getByRole('button', { name: 'Rouler' }).click(); await sleep(800);
check(await ev(() => window.playzone.vehicles.current?.model === 'kart'), `au volant d'un kart (-${c0 - (await prof()).coins} PC)`);
await ev(() => { const g = window.playzone; g.cam.dist = 7; g.cam.pitch = 0.35; g.debugStep(0.5); });
await sleep(400);
await page.screenshot({ path: 'tests/e2e/out/kart-piste.png' });
const laps = await drive(3, 22);
check(laps >= 2, `tours chronométrés : ${laps}`);
await ev(() => window.playzone.karting.end()); await sleep(900);
let p = await prof();
check(p.karting.best > 15 && p.karting.best < 30, `meilleur tour validé : ${p.karting.best} s`);
check(/Fin de session/.test(await page.locator('.modal').last().textContent()), 'bilan de la session');
await ev(() => { for (const m of [...window.playzone.ui.stack]) m.close(); });

// 2) course du jour (on se place pendant le créneau)
await ev(async () => {
  const g = window.playzone; const { occurrences } = await import('/shared/calendar.js');
  const now = g.now(); const o = occurrences(now, now + 7 * 24 * 600_000).find((x) => x.id === 'course-jour');
  const shift = o.start + 60_000 - now; g.world.dayNight.shift = shift; localStorage.setItem('playzone.timeShift', String(shift));
});
await toDesk(); await page.keyboard.press('KeyE'); await sleep(400);
await page.getByRole('button', { name: 'Courses', exact: true }).click(); await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/kart-courses.png' });
await page.getByRole('button', { name: 'Prendre le départ' }).first().click(); await sleep(300);
check(await page.locator('.kart-lights').count() === 1, 'feux de départ');
await sleep(1200);
check(await ev(() => window.playzone.karting.s?.npcs.length === 5), 'grille : 5 pilotes PNJ');
await ev(() => { const g = window.playzone; g.cam.dist = 9; g.cam.pitch = 0.45; g.debugStep(0.3); });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/kart-grille.png' });
await sleep(3200);
// premier tour en mode « réel » pour voir les PNJ rouler, puis le reste
await drive(1, 24);
await ev(() => { const g = window.playzone; g.cam.dist = 12; g.cam.pitch = 0.6; g.debugStep(0.2); });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/kart-course.png' });
await drive(3, 16);
// quelques pas de jeu pour que la ligne d'arrivée soit traitée (les images sont lentes en rendu logiciel)
await ev(() => window.playzone.debugStep(0.5));
await page.waitForFunction(() => !window.playzone.karting.s, null, { timeout: 15000 }).catch(() => {});
await sleep(600);
p = await prof();
const res = await page.locator('.modal').last().textContent().catch(() => '');
check(p.karting.races === 1 && /PNJ/.test(res), `course terminée : ${p.karting.history.at(-1)?.place}e place sur ${p.karting.history.at(-1)?.of}`);
await page.screenshot({ path: 'tests/e2e/out/kart-podium.png' });

console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
