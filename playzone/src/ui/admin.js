import { h, fmt } from './dom.js';
import { destinations } from './gps.js';
import { HOUR_MS } from '../../shared/clock.js';

// MODE ADMIN : guichet de la mairie (code) et appli « Admin » du téléphone (pouvoirs, téléportation).

export function adminKiosk(g) {
  if (g.profile.admin) { g.ui.toast('👑 Mode admin déjà actif : ouvre l\'appli Admin du téléphone.', 'good'); g.phone?.open('admin'); return; }
  let code = '';
  const m = g.ui.modal({
    title: '🔐 Guichet spécial', sub: 'Entre le code d\'accès.',
    width: 'min(420px, 94vw)',
    build: (b) => {
      const inp = h('input.input', { type: 'password', placeholder: 'Code', autocomplete: 'off', oninput: (e) => { code = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); } });
      b.append(inp);
      setTimeout(() => inp.focus(), 50);
    },
    foot: (f) => f.append(h('button.btn.ghost', { onclick: () => m.close() }, 'Annuler'), h('button.btn', { onclick: () => go() }, 'Valider')),
  });
  async function go() {
    try {
      await g.net.request('admin.unlock', { code });
      m.close(); g.sfx('levelup');
      g.ui.toast('👑 Mode admin activé : argent illimité, niveau max, permis. Pouvoirs dans l\'appli Admin du téléphone.', 'good', 6000);
    } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
  }
}

export function adminApp(g, b, phone) {
  if (!g.profile.admin) { b.append(h('p', 'Le mode admin s\'active avec un code au guichet spécial de la mairie.')); return; }
  const power = async (p, msg) => { try { await g.net.request('admin.power', { power: p }); g.sfx('success'); g.ui.toast(msg, 'good'); if (p === 'clean') { g.police?.clearUnits?.(); g.police?.renderStars?.(); } phone.render(); } catch (e) { g.ui.toast(e.message, 'bad'); } };
  b.append(h('p', `👑 Admin · ${fmt(g.profile.coins)} PC (illimité)`));
  b.append(h('div.list',
    h('button.btn.block', { onclick: () => power('items', '🎁 Tous les vêtements et meubles sont dans ton sac.') }, '🎁 Tout débloquer (vêtements, meubles)'),
    h('button.btn.block', { onclick: () => power('clean', '😇 Casier propre : plus recherché·e, sorti·e de prison.') }, '😇 Effacer les recherches / sortir de prison'),
    h('button.btn.block', { onclick: () => power('heal', '❤️ Santé et besoins au maximum.') }, '❤️ Soigner et remplir les besoins'),
    g.net.mode === 'solo' ? h('button.btn.block', { onclick: () => { const dn = g.world.dayNight; dn.shift = (dn.shift || 0) + 2 * HOUR_MS; try { localStorage.setItem('playzone.timeShift', String(dn.shift)); } catch { /* rien */ } g.ui.toast('⏩ +2 heures de jeu'); } }, '⏩ Avancer l\'heure (+2 h de jeu)') : null,
    h('button.btn.block.ghost', { onclick: async () => { await g.net.request('admin.lock', {}); phone.render(); } }, 'Désactiver le mode admin')));
  b.append(h('h4', { style: { margin: '12px 0 6px' } }, 'Téléportation'));
  const sel = h('select.input', destinations(g.profile).map((d) => h('option', { value: `${d.x},${d.z}` }, d.name)));
  b.append(sel, h('button.btn.block', { style: { marginTop: '6px' }, onclick: () => {
    if (g.vehicles?.current) g.vehicles.exit(true);
    const [x, z] = sel.value.split(',').map(Number); g.player.teleport(x, z + 1.5, g.player.yaw); phone.close();
  } }, '🌀 Y aller'));
}
