import { h } from './dom.js';
import { TEXTS, TEXT_REPLIES, CALL_LINES, loveEmoji, lovePhase } from '../../shared/romance.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';

// Appli « Contacts » : les numéros obtenus. Écrire un SMS, appeler, ou lui proposer de te rejoindre.
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function contactsApp(g, b, phone) {
  const L = g.profile.love || {}, C = L.contacts || {};
  const ids = Object.keys(C).sort((x, y) => (L.aff?.[y] || 0) - (L.aff?.[x] || 0));
  const req = async (type, payload) => { try { return await g.net.request(type, payload); } catch (e) { g.ui.toast(e.message, 'bad', 3000); g.sfx('error'); return null; } };
  if (!ids.length) {
    b.append(h('p', '📇 Aucun numéro pour l\'instant.'), h('p.muted', 'Parle à quelqu\'un dans la rue, au café ou en boîte, puis choisis « 📱 Demander son numéro » : on te le donne presque toujours !'));
    return;
  }
  b.append(h('p.muted', `${ids.length} contact${ids.length > 1 ? 's' : ''} · un SMS ou un appel fait monter l'affection.`));
  for (const id of ids) {
    const c = C[id], a = L.aff?.[id] || 0, mine = L.partner?.id === id;
    const sms = async () => {
      const r = await req('love.text', { id, kind: 'sms' }); if (!r) return;
      g.sfx('pop');
      g.ui.toast(`💬 Toi : « ${pick(TEXTS)} »`, '', 2500);
      setTimeout(() => { g.sfx('ring'); g.ui.toast(`💬 ${c.name} : « ${pick(TEXT_REPLIES)} »  ${loveEmoji(r.aff)} ${r.aff}/100`, 'good', 4500); phone.el && phone.render(); }, 1800);
    };
    const call = async () => {
      const r = await req('love.text', { id, kind: 'call' }); if (!r) return;
      g.sfx('ring'); g.emit('needs', r.needs);
      g.ui.toast(`${pick(CALL_LINES)}  ${loveEmoji(r.aff)} ${r.aff}/100`, 'good', 5000);
      phone.render();
    };
    const meet = () => {
      const n = g.npcs?.list.find((x) => (x.def.id || x.def.name) === id);
      const P = g.player.pos;
      if (n && g.player.zone === 'world') {
        // elle arrive en marchant près de toi, puis te suit
        n.pos.x = P.x + Math.sin(g.player.yaw + 2.6) * 7; n.pos.z = P.z + Math.cos(g.player.yaw + 2.6) * 7;
        n.avatar?.root.position.set(n.pos.x, n.pos.y ?? 0, n.pos.z);
        n.command('follow', 600); n.say?.('🥰 Me voilà !', 3500);
        g.sfx('success'); g.ui.toast(`🌹 ${c.name} arrive ! Elle va te suivre un moment.`, 'good', 4500);
        phone.close();
      } else if (c.where && BUILDING_BY_ID[c.where]) {
        const B = BUILDING_BY_ID[c.where];
        g.ui.toast(`🌹 ${c.name} : « Rejoins-moi à ${B.name} ! » — le GPS t'y emmène.`, 'good', 4500);
        phone.goTo({ x: B.door.x, z: B.door.z, name: `${c.name} (${B.name})` });
      } else g.ui.toast(`📵 ${c.name} est occupé·e en ce moment. Écris-lui un SMS !`, '', 3500);
    };
    b.append(h('div.list-item', { style: { flexWrap: 'wrap', gap: '6px' } },
      h('div.grow', h('div.t', `${mine ? '💞 ' : ''}${c.name}`), h('div.d', `${loveEmoji(a)} ${lovePhase(a)} · ${a}/100${c.role ? ` · ${c.role}` : ''}`)),
      h('button.btn.small', { onclick: sms }, '💬 SMS'),
      h('button.btn.small', { onclick: call }, '📞 Appeler'),
      h('button.btn.small.ghost', { onclick: meet }, '🌹 Rejoins-moi')));
  }
}
