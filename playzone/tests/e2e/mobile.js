// Téléphone (390x844, tactile) : contrôles tactiles, joystick, boutons, téléphone virtuel.
import { staticServer, launch, watchConsole, sleep } from './lib.js';
const { srv, url } = await staticServer();
const { browser, context } = await launch({ width: 390, height: 844, mobile: true });
const page = await context.newPage();
const errors = watchConsole(page);
await page.addInitScript(() => localStorage.setItem('playzone.save.v1', JSON.stringify({ v: 1, id: 'solo-t', name: 'Mobile', createdAt: 0, coins: 300, xp: 0, rep: 0, appearance: { hair: 'couettes', hairColor: '#ff5ab4' } })));
await page.goto(url + 'index.html?heure=12&auto=solo');
await sleep(6000);
const touchOn = await page.evaluate(() => document.querySelector('.touch')?.classList.contains('on'));
console.log('contrôles tactiles affichés :', touchOn);
// joystick : glisser le pouce vers le haut sur la moitié gauche
const p0 = await page.evaluate(() => ({ ...window.playzone.player.pos }));
const cdp = await context.newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 600, id: 1 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 540, id: 1 }] });
await sleep(300);
await page.screenshot({ path: 'tests/e2e/out/s9-mobile.png' });
await page.evaluate(() => window.playzone.debugStep(1));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const p1 = await page.evaluate(() => ({ ...window.playzone.player.pos }));
const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
console.log('déplacement au joystick :', moved.toFixed(2), 'm');
// bouton sauter
await page.locator('.tbtn[aria-label="Sauter"]').dispatchEvent('pointerdown');
await page.evaluate(() => window.playzone.debugStep(0.2));
const y = await page.evaluate(() => window.playzone.player.pos.y);
console.log('hauteur après le bouton Sauter :', y.toFixed(2));
// téléphone
await page.locator('.icon-btn', { hasText: '📱' }).click();
await sleep(600);
await page.screenshot({ path: 'tests/e2e/out/s9-mobile-phone.png' });
const ok = touchOn && moved > 2 && y > 0.5;
console.log(ok ? 'OK' : 'ÉCHEC');
console.log(errors.filter((e) => !/404/.test(e)).join('\n') || 'Aucune erreur console');
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
