import { h, fmt } from '../ui/dom.js';
import { LOVE, DATES, GIFTS, FLIRT_YES, FLIRT_NO, lovePhase, loveEmoji } from '../../shared/romance.js';

// AMOUR, côté dialogue : complimenter, offrir, inviter, se mettre en couple, venir à la maison,
// câlin, demande en mariage. Les règles et les tirages sont dans l'autorité (love.*).
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const idOf = (n) => n.def.id || n.def.name;

export function loveLine(g, n) {
  const L = g.profile.love, a = L?.aff?.[idOf(n)] || 0;
  if (L?.partner?.id === idOf(n)) return `${L.married ? '💍 Ton époux·se' : '💞 Ton amour'} · affection ${a}/100`;
  return a > 0 ? `${loveEmoji(a)} ${lovePhase(a)} · affection ${a}/100` : '';
}

export function loveChoices(g, n, back) {
  const L = g.profile.love || {}, id = idOf(n), a = L.aff?.[id] || 0, mine = L.partner?.id === id;
  const req = async (type, payload) => { try { return await g.net.request(type, payload); } catch (e) { g.ui.toast(e.message, 'bad', 3500); g.sfx('error'); return null; } };
  const out = [];
  out.push({ label: '💘 Faire un compliment', action: async (m) => {
    const r = await req('love.flirt', { id, name: n.def.name });
    if (!r) return;
    n.command(r.yes ? 'happy' : 'refuse');
    if (r.yes) g.sfx('success');
    m.show(`${r.yes ? pick(FLIRT_YES) : pick(FLIRT_NO)}\n${loveEmoji(r.aff)} Affection : ${r.aff}/100 (chance ${r.chance} %)`, back());
  } });
  const gifts = Object.keys(GIFTS).filter((k) => (g.profile.inventory[k] || 0) > 0);
  if (gifts.length) out.push({ label: '🎁 Offrir un cadeau', action: (m) => m.show('Quel cadeau ?', [
    ...gifts.map((k) => ({ label: `${g.net.content.items[k]?.emoji || '🎁'} ${g.net.content.items[k]?.name || k} (+${GIFTS[k]})`, action: async (mm) => {
      const r = await req('love.gift', { id, itemId: k });
      if (!r) return;
      n.command('happy'); g.sfx('success');
      mm.show(`${pick(['😍 Pour moi ? Il ne fallait pas !', '🥹 C\'est trop gentil...', '💖 Je le garde précieusement.'])}\n${loveEmoji(r.aff)} Affection : ${r.aff}/100`, back());
    } })),
    { label: '↩︎ Retour', ghost: true, action: (mm) => mm.show(n.def.name, back()) },
  ]) });
  if (a >= LOVE.dateMin) out.push({ label: '🌹 Proposer un rendez-vous', action: (m) => m.show('On fait quoi ?', [
    ...Object.entries(DATES).map(([k, D]) => ({ label: `${D.emoji} ${D.name}${D.price ? ` (${g.profile.admin ? 'gratuit' : `${fmt(D.price)} PC`})` : ''}`, action: async (mm) => {
      const r = await req('love.date', { id, kind: k });
      if (!r) return;
      g.emit('needs', r.needs); g.sfx('cash');
      n.command('follow');
      mm.show(`${D.emoji} ${pick(['Quelle belle soirée ! On remet ça quand tu veux.', 'J\'ai passé un super moment avec toi.', 'Tu es vraiment quelqu\'un de bien.'])}\n${loveEmoji(r.aff)} Affection : ${r.aff}/100`, back());
    } })),
    { label: '↩︎ Retour', ghost: true, action: (mm) => mm.show(n.def.name, back()) },
  ]) });
  if (!mine && !L.partner && a >= 45) out.push({ label: '💞 Lui demander de sortir ensemble', action: async (m) => {
    const r = await req('love.ask', { id, name: n.def.name, role: n.def.role });
    if (!r) return;
    if (r.yes) { n.command('hug'); g.sfx('levelup'); g.ui.toast(`💞 Tu es en couple avec ${n.def.name} !`, 'good', 5000); m.show('💞 Oui ! Je n\'attendais que ça...', back()); }
    else { n.command('refuse'); m.show(`😅 C'est un peu tôt... Apprenons à mieux nous connaître. (affection ${r.aff}/${LOVE.couple})`, back()); }
  } });
  if (mine) {
    out.push({ label: '🤗 Faire un câlin', action: async (m) => {
      const r = await req('love.cuddle', {});
      if (!r) return;
      n.command('hug'); g.emit('needs', r.needs); g.sfx('pop');
      m.show(`🥰 ${pick(['Je suis bien avec toi.', 'Tu m\'as manqué !', 'On reste comme ça encore un peu ?'])}`, back());
    } });
    out.push({ label: '🏠 Viens avec moi', action: (m) => { n.command('follow', 900); g.ui.toast(`💞 ${n.def.name} te suit. Emmène-l·e chez toi, à la piscine, au resto...`, 'good', 4500); m.close(); } });
    if (!L.married && (g.profile.inventory['bague-diamant'] || 0) > 0) out.push({ label: '💍 Demander en mariage', action: async (m) => {
      const r = await req('love.propose', {});
      if (!r) return;
      if (r.yes) { n.command('hug'); g.sfx('levelup'); g.fx?.emit?.({ x: n.pos.x, y: 2, z: n.pos.z, n: 40, colors: ['#ff4d6d', '#ffd166', '#ffffff'], speed: 4, gravity: 3, life: 1.6, size: 0.12 }); g.ui.toast(`💍 ${n.def.name} a dit OUI !`, 'good', 6000); m.show('💍 OUI ! Mille fois oui !', back()); }
      else m.show(`🥹 C'est trop tôt... Encore un peu de patience. (affection ${r.aff}/${LOVE.marry})`, back());
    } });
    out.push({ label: '💔 Rompre', ghost: true, action: (m) => m.show(`Tu es sûr·e de vouloir quitter ${n.def.name} ?`, [
      { label: '💔 Oui, rompre', action: async (mm) => { const r = await req('love.breakup', {}); if (r) { n.command('angry'); mm.show('😢 Très bien. Adieu.', back()); } } },
      { label: 'Non !', ghost: true, action: (mm) => mm.show(n.def.name, back()) },
    ]) });
  }
  return out;
}
