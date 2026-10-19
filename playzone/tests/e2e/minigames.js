// Étape 4 : les 3 mini-jeux joués de bout en bout (en temps réel, comme un joueur).
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const which = process.argv[2] || 'all';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Testeur', createdAt: 0, coins: 500, xp: 0, rep: 0, appearance: {} })));
await page.goto(url + 'index.html?heure=12&auto=solo');
await sleep(5000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const coins = () => ev(() => window.playzone.profile.coins);
let ok = true;

async function openAndPlay(x, z) {
  await ev(([x, z]) => { const g = window.playzone; g.player.teleport(x, z + 1, Math.PI); g.debugStep(0.2); }, [x, z]);
  await page.keyboard.press('KeyE');
  await sleep(600);
  await page.getByRole('button', { name: '▶ Jouer' }).click();
  await sleep(300);
}

if (which === 'all' || which === 'tartes') {
  const c0 = await coins();
  await openAndPlay(-30, -73);
  await sleep(3200);
  let clicks = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    const pts = await ev(() => {
      const g = window.playzone, mg = g.minigames.current;
      if (!mg || !mg.meshes) return [];
      return mg.meshes.filter((m) => m.visible && !mg.hits.has(m.userData.i) && mg.targets[m.userData.i].type !== 'mamie' && m.rotation.x > -0.2)
        .map((m) => g.toScreen({ x: m.position.x, y: 1.9, z: m.position.z }));
    });
    if (pts[0]) { await page.mouse.click(pts[0].x, pts[0].y); clicks++; }
    await sleep(350);
    if (clicks === 3) await page.screenshot({ path: 'tests/e2e/out/s4-tartes.png' });
    if (!(await ev(() => !!window.playzone.minigames.current))) break;
  }
  await sleep(2500);
  const res = await page.locator('.panel .stat b').first().textContent().catch(() => '?');
  await page.screenshot({ path: 'tests/e2e/out/s4-tartes-fin.png' });
  const c1 = await coins();
  console.log(`TARTES : ${clicks} lancers, résultat affiché ${res}, PC ${c0} -> ${c1}`);
  ok = ok && c1 > c0;
  await page.keyboard.press('Escape');
}

if (which === 'all' || which === 'poulets') {
  const c0 = await coins();
  await openAndPlay(0, -88);
  await sleep(3300);
  for (let k = 0; k < 12; k++) {
    const pos = await ev(() => { const mg = window.playzone.minigames.current; const c = mg?.chickens?.find((x) => !x.done); return c ? { x: c.x, z: c.z } : null; });
    if (!pos) break;
    await ev((p) => { const g = window.playzone; g.player.teleport(p.x + 0.6, p.z, 0); g.minigames.current.chickens.forEach((c) => { c.walking = false; }); g.debugStep(0.05); }, pos);
    await page.keyboard.press('KeyE');
    await sleep(250);
    await ev(() => { const g = window.playzone; g.player.teleport(0, -98.5, 0); g.debugStep(0.05); });
    if (k === 0) await page.screenshot({ path: 'tests/e2e/out/s4-poulets.png' });
    await page.keyboard.press('KeyE');
    await sleep(1000);
  }
  await sleep(2500);
  const res = await page.locator('.panel .stat b').first().textContent().catch(() => '?');
  const c1 = await coins();
  console.log(`POULETS : résultat ${res}, PC ${c0} -> ${c1}`);
  ok = ok && c1 > c0 && res.startsWith('12');
  await page.keyboard.press('Escape');
}

if (which === 'all' || which === 'parcours') {
  // 1) triche : téléportation d'anneau en anneau en 3 s -> refusée par l'autorité
  await openAndPlay(26, -70);
  await sleep(3300);
  const cps = await ev(() => window.playzone.minigames.current.constructor.name && [[26, -80, 0], [26, -96, 0], [34, -112, 3.2], [48, -116, 0], [48, -98, 0], [48, -80, 0]]);
  for (const [x, z, y] of cps) { await ev(([x, z, y]) => { const g = window.playzone; g.player.teleport(x, z, Math.PI, y); g.debugStep(0.15); }, [x, z, y]); await sleep(450); }
  await sleep(1500);
  const toasts = await page.locator('.toast').allTextContents();
  console.log('PARCOURS (triche en 3 s) :', toasts.find((t) => /impossible/i.test(t)) || toasts.join(' | '));
  ok = ok && toasts.some((t) => /impossible/i.test(t));
  // 2) partie "réaliste" : 2,5 s par anneau
  const c0 = await coins();
  await openAndPlay(26, -70);
  await sleep(3300);
  for (const [x, z, y] of cps) { await sleep(2500); await ev(([x, z, y]) => { const g = window.playzone; g.player.teleport(x, z, Math.PI, y); g.debugStep(0.15); }, [x, z, y]); }
  await sleep(2500);
  const res = await page.locator('.panel .stat b').first().textContent().catch(() => '?');
  const title = await page.locator('.panel h2').first().textContent().catch(() => '?');
  await page.screenshot({ path: 'tests/e2e/out/s4-parcours-fin.png' });
  const c1 = await coins();
  console.log(`PARCOURS : ${title} ${res}, PC ${c0} -> ${c1}`);
  ok = ok && c1 > c0;
}
console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
