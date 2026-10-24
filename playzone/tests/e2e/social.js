// Discussion libre avec un PNJ, appareil photo (selfie, filtre) et publication PlayGram, loto quotidien.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch();
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-s', name: 'Photographe', createdAt: 0, coins: 5000, xp: 3000, rep: 10, appearance: {} })));
await page.goto(url + 'index.html?heure=11&auto=solo&qualite=medium');
await page.waitForFunction(() => window.playzone?.player, null, { timeout: 90000 });
await sleep(3000);
await page.addStyleTag({ content: '.phone { animation: none !important; }' });
const ev = (fn, arg) => page.evaluate(fn, arg);
let ok = true;
const check = (c, m) => { console.log(c ? '✔' : '✘', m); if (!c) ok = false; };

// 1) discussion libre avec un habitant
await ev(() => { const g = window.playzone; const n = g.npcs.list.find((x) => x.def.kind === 'crowd' && x.avatar.root.visible) || g.npcs.list[0]; g.player.teleport(n.pos.x + 1.2, n.pos.z, -Math.PI / 2); g.debugStep(0.1); g.npcs.talk(n); });
await page.getByText('⌨️ Écrire').click();
const say = async (t) => { await page.locator('.dlg-input').fill(t); await page.locator('.dlg-input').press('Enter'); await sleep(250); return page.locator('.dialog-box p').textContent(); };
const a1 = await say('Bonjour, je m\'appelle Timao');
check(/Timao/.test(a1), `le PNJ retient mon prénom : ${a1.split('\n')[1]}`);
const a2 = await say('Où est le commissariat ?');
check(/Commissariat.*(nord|sud|est|ouest)/.test(a2), `il m'indique le chemin : ${a2.split('\n')[1]}`);
const a3 = await say('Raconte-moi une blague');
check(a3.split('\n')[1].length > 20, `blague : ${a3.split('\n')[1]}`);
await page.screenshot({ path: 'tests/e2e/out/social-chat.png' });
await page.getByText('Au revoir').last().click();

// 2) appareil photo : selfie, filtre, publication
await ev(() => { const g = window.playzone; g.phone.open('social'); });
await sleep(500);
check(await page.locator('.sg-tabs button').count() === 3, 'PlayGram : onglets Fil / Mes posts / Galerie');
await page.screenshot({ path: 'tests/e2e/out/social-app.png' });
await page.getByText('📷 Appareil photo').click();
await sleep(400);
check(await page.locator('.cam-shutter').isVisible(), 'viseur ouvert');
await page.keyboard.press('KeyF'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
await sleep(800);
await page.screenshot({ path: 'tests/e2e/out/social-viseur.png' });
check(await page.locator('.cam-filter').textContent() === 'Rétro', 'filtre Rétro');
await page.locator('.cam-shutter').click();
await sleep(700);
const t0 = Date.now(); const shot = await page.locator('.cam-review').waitFor({ timeout: 30000 }).then(() => true, () => false);
check(shot, `photo prise (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
await page.getByText('📤 Publier').click();
await sleep(400);
await page.locator('.sg-compose-modal textarea').fill('Selfie au soleil ☀️');
await page.locator('.sg-compose-modal .panel-foot .btn').last().click();
await sleep(600);
const post = await ev(() => window.playzone.profile.social.posts.at(-1));
check(post?.photo?.length > 7000 && post.text.includes('Selfie'), `publiée : photo de ${Math.round((post?.photo?.length || 0) / 1024)} Ko + légende`);
await ev(() => window.playzone.phone.open('social'));
await sleep(500);
await page.screenshot({ path: 'tests/e2e/out/social-fil.png' });
check(await page.locator('.sg-post img.sg-photo').count() >= 1, 'la photo apparaît dans le fil');
await page.getByText('🖼️ Galerie').click(); await sleep(300);
check(await page.locator('.sg-cell img').count() >= 1, 'gardée dans la galerie');
await ev(() => window.playzone.phone.close());

// 3) loto
await ev(() => window.playzone.phone.open('loto'));
await sleep(400);
const c0 = await ev(() => window.playzone.profile.coins);
await page.getByText(/Acheter un ticket/).click();
await sleep(450 * 8 + 300);
await page.screenshot({ path: 'tests/e2e/out/social-loto.png' });
const L = await ev(() => window.playzone.profile.lotto);
const c1 = await ev(() => window.playzone.profile.coins);
check(L.played === 1 && (c1 === c0 - 10 || c1 === c0 - 10 + 1_000_000), `ticket joué (${L.last[0].win ? 'GAGNÉ' : 'perdu'}) : ${c0} → ${c1} PC`);
check(await page.locator('.lotto-balls .ball:not(.hide)').count() === 6, 'six boules tirées');
const again = await ev(() => window.playzone.net.request('loto.play', {}).then(() => 'ok', (e) => e.message));
check(/Un seul ticket/.test(again), 'un seul ticket par jour');

console.log(ok ? 'OK' : 'ÉCHEC');
const errs = errors.filter((e) => !/status of 404|AudioContext/.test(e));
console.log(errs.length ? errs.join('\n') : 'Aucune erreur console');
await browser.close(); srv.close(); process.exit(ok && !errs.length ? 0 : 1);
