import { h, fmt } from './dom.js';
import { followersOf, likesOf } from '../../shared/authority-social.js';
import { CHARACTERS } from '../characters/crowd-data.js';
import { occurrences, CAL_BY_ID, occLabel } from '../../shared/calendar.js';
import { HOUR_MS } from '../../shared/clock.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { calNow } from '../events/agenda.js';

// PLAYGRAM : le réseau social du téléphone. Tes publications (texte + photo prise en jeu), tes abonnés
// et tes likes ; le fil des habitants (personnages de la ville, actus du calendrier, résultats).

// Petite photo de la vue actuelle (JPEG réduit, pour tenir dans un message réseau).
export function snapshot(g) {
  const e = g.engine;
  e.renderer.render(e.scene, e.camera);
  const src = e.renderer.domElement;
  const c = document.createElement('canvas');
  c.width = 112; c.height = Math.round(112 * src.height / src.width);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.55);
}

const ago = (ms) => { const m = Math.max(1, Math.round(ms / 60_000)); return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`; };

// Publications des habitants : déterministes par tranche de 20 minutes (tout le monde voit les mêmes).
function npcFeed(g, now) {
  const out = [];
  for (let k = 0; k < 6; k++) {
    const slot = Math.floor(now / 1_200_000) - k;
    const r = mulberry32(hashString(`feed:${slot}`));
    const c = CHARACTERS[Math.floor(r() * CHARACTERS.length)];
    out.push({ who: c.name, role: c.role, text: c.lines[Math.floor(r() * c.lines.length)], at: slot * 1_200_000 + r() * 600_000, likes: Math.round(20 + r() * 900) });
  }
  // annonces du calendrier
  const cn = calNow(g);
  for (const o of occurrences(cn, cn + 6 * HOUR_MS).slice(0, 2)) {
    const ev = CAL_BY_ID[o.id];
    out.push({ who: 'Mairie de PLAYZONE', role: 'Compte officiel', text: `${ev.emoji} ${ev.name} — ${occLabel(o)}. ${ev.desc}`, at: now - 300_000, likes: 140 });
  }
  return out;
}

export function socialApp(g, b, phone) {
  const p = g.profile, now = g.now();
  const followers = followersOf(p);
  const mine = (p.social?.posts || []).slice().reverse();
  const totalLikes = mine.reduce((s, x) => s + likesOf(x, followers, now), 0);
  b.append(h('div.sg-head', h('div.sg-avatar', p.name.slice(0, 1).toUpperCase()), h('div.grow', h('b', `@${p.name.replace(/\s+/g, '').toLowerCase()}`), h('div.d', `${fmt(followers)} abonnés · ${fmt(totalLikes)} likes · ${mine.length} publications`))));
  let text = '', photo = null;
  const prev = h('div.sg-preview');
  const ta = h('textarea.input', { maxlength: 140, rows: 2, placeholder: 'Quoi de neuf ? (140 caractères)', oninput: (e) => { text = e.target.value; }, onkeydown: (e) => e.stopPropagation() });
  b.append(h('div.sg-compose', ta, prev, h('div.row-btns',
    h('button.btn.small.ghost', { onclick: () => { phone.el.style.visibility = 'hidden'; setTimeout(() => { photo = snapshot(g); phone.el.style.visibility = ''; prev.replaceChildren(h('img', { src: photo, alt: 'photo' })); g.sfx('pop'); }, 60); } }, '📸 Photo'),
    h('button.btn.small', { onclick: async () => { try { await g.net.request('social.post', { text, photo }); g.sfx('success'); g.ui.toast('📱 Publié sur PlayGram !', 'good'); phone.render(); } catch (e) { g.ui.toast(e.message, 'bad'); } } }, 'Publier'))));
  const feed = [
    ...mine.map((x) => ({ who: p.name, role: 'Toi', text: x.text, photo: x.photo, at: x.at, likes: likesOf(x, followers, now), id: x.id })),
    ...npcFeed(g, now),
  ].sort((a, c) => c.at - a.at);
  for (const x of feed) {
    b.append(h('div.sg-post',
      h('div.sg-who', h('b', x.who), h('span.muted', ` · ${x.role} · il y a ${ago(now - x.at)}`)),
      x.text ? h('div', x.text) : null,
      x.photo ? h('img.sg-photo', { src: x.photo, alt: 'photo' }) : null,
      h('div.sg-meta', `❤️ ${fmt(x.likes)}`, x.id ? h('button.btn.small.ghost', { onclick: async () => { await g.net.request('social.delete', { id: x.id }); phone.render(); } }, 'Supprimer') : null)));
  }
}
