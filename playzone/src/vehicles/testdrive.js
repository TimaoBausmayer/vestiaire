import { WorldVehicle } from './vehicles.js';
import { VEHICLES } from '../../shared/content/vehicles.js';
import { h } from '../ui/dom.js';

// ESSAI GRATUIT avant achat : la voiture choisie attend devant la concession pendant 3 minutes.
// On la rend en descendant (ou à la fin du temps) : retour automatique à la concession.
const DURATION = 180;

export function testDrivePanel(g, b, shopId) {
  const list = Object.entries(VEHICLES).filter(([id, s]) => s.kind === 'car' && s.price > 0 && (shopId === 'cars-luxe' ? s.price >= 100000 : s.price < 100000) && g.net.content.items[id]?.shop === shopId);
  const m = g.ui.modal({
    title: '🔑 Essai gratuit', sub: `Choisis une voiture : ${DURATION / 60} minutes au volant, gratuit. Le permis est obligatoire.`,
    build: (body) => {
      for (const [id, s] of list) body.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, '🚗'),
        h('div.grow', h('div.t', s.name), h('div.d', `${Math.round(s.max * 3.6)} km/h · 0-100 en ${(27.8 / s.acc).toFixed(1)} s · ${Math.round(s.price).toLocaleString('fr-FR')} PC`)),
        h('button.btn.small', { onclick: () => { m.close(); startTestDrive(g, b, id); } }, 'Essayer')));
    },
  });
}

export function startTestDrive(g, b, model) {
  if (!g.profile.justice?.licence?.permis) { g.ui.toast('Il faut le permis de conduire pour un essai (auto-école, Avenue de Prestige).', 'bad', 4500); return; }
  if (g.testDrive) endTestDrive(g, false);
  if (g.vehicles.current) g.vehicles.exit(true);
  // devant la porte, sur la chaussée
  const dz = b.facing === 'S' ? 1 : b.facing === 'N' ? -1 : 0, dx = b.facing === 'E' ? 1 : b.facing === 'W' ? -1 : 0;
  const x = b.door.x + dx * 14, z = b.door.z + dz * 14;
  const v = new WorldVehicle(g, { model, color: VEHICLES[model].paint || '#e63946', x, z, yaw: Math.PI / 2, owner: 'essai' });
  g.vehicles.list.push(v);
  g.vehicles.enter(v);
  const td = g.testDrive = { v, b, until: g.now() + DURATION * 1000 };
  g.ui.toast(`🔑 Essai de la ${VEHICLES[model].name} : ${DURATION / 60} min. Descends pour la rendre.`, 'good', 5000);
  const off = g.on('vehicle.exit', (ve) => { if (ve === td.v) { off?.(); endTestDrive(g, true); } });
  td.timer = setInterval(() => {
    if (g.testDrive !== td) { clearInterval(td.timer); return; }
    const left = Math.max(0, Math.round((td.until - g.now()) / 1000));
    g.hud.track('testdrive', { title: `🔑 Essai : ${VEHICLES[model].name}`, text: `Temps restant : ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, bar: left / DURATION });
    if (left <= 0) endTestDrive(g, true);
  }, 500);
}

export function endTestDrive(g, back = true) {
  const td = g.testDrive;
  if (!td) return;
  g.testDrive = null;
  clearInterval(td.timer);
  g.hud.track('testdrive', null);
  if (g.vehicles.current === td.v) g.vehicles.exit(true);
  const dmg = td.v.sim?.damage || 0;
  g.vehicles.despawn(td.v, false);
  if (back) g.player.teleport(td.b.door.x, td.b.door.z + (td.b.facing === 'S' ? 2 : -2), 0);
  g.ui.dialog({ name: 'Commercial·e', role: td.b.name, text: dmg > 0.15 ? 'Euh... elle a quelques bosses. On dira que c\'était déjà là. Alors, convaincu·e ?' : 'Alors ? Elle vous plaît ? Le catalogue est au bureau, à l\'intérieur !', choices: [{ label: 'OK', ghost: true, action: (m) => m.close() }] });
}
