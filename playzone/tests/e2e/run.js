// Lance tous les tests de bout en bout (Chromium sans écran, rendu WebGL logiciel).
// Usage : npm run test:e2e
import { spawnSync } from 'node:child_process';
const SUITES = ['move.js', 'step2.js', 'step3.js', ['minigames.js', 'all'], ['jobs.js', 'all'], 'step6.js', 'events.js', 'mobile.js', 'multiplayer.js', 'drive.js', 'city.js', 'interiors.js', 'property.js', 'life.js', 'economy.js', 'careers.js', 'business.js', 'body.js', 'police.js', 'leisure.js', 'karting.js', 'markets.js', 'fixes.js', 'bigmap.js', 'football.js', 'wingfoil.js', 'courses.js', 'urgences.js', 'metiers.js', 'expansion.js', 'velo.js', 'equipement.js', 'achats.js', 'voile.js', 'tribunal.js', 'social.js', 'plongee.js', 'etages.js', 'pumpfoil.js', 'pnj-actions.js'];
const only = process.argv.slice(2);
let failed = 0;
for (const s of SUITES.filter((s) => !only.length || only.includes([].concat(s)[0]))) {
  const [file, ...args] = [].concat(s);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', `tests/e2e/${file}`, ...args], { stdio: 'pipe', encoding: 'utf8', timeout: 420_000 });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✘'} ${file} ${args.join(' ')} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!ok) console.log((r.stdout || '') + (r.stderr || ''));
}
console.log(failed ? `${failed} suite(s) en échec` : 'Toutes les suites e2e passent.');
process.exit(failed ? 1 : 0);
