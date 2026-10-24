import { h, fmt } from './dom.js';
import { followersOf, likesOf } from '../../shared/authority-social.js';
import { CHARACTERS } from '../characters/crowd-data.js';
import { occurrences, CAL_BY_ID, occLabel } from '../../shared/calendar.js';
import { HOUR_MS } from '../../shared/clock.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { calNow } from '../events/agenda.js';
import { openCamera, loadGallery, removeFromGallery } from './camera-app.js';

// PLAYGRAM : le réseau social du téléphone. Appareil photo (selfie, filtres), galerie, publications
// avec légende, abonnés, likes et commentaires ; le fil des habitants (personnages, actus du calendrier).

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

// Commentaires des habitant·es sous une publication (déterministes, ils arrivent avec le temps).
const COMMENTS = ['Trop beau ! 😍', 'Wouah, c\'est où ça ?', 'La classe 🔥', 'Je valide 👌', 'Magnifique !', 'Haha génial 😂', 'J\'adore !', 'Invite-moi la prochaine fois !', 'Quelle vue 🌅', 'Stylé·e comme toujours', 'Ça donne envie !', '❤️❤️❤️'];
function commentsOf(x, now) {
  const r = mulberry32((x.seed || 7) * 7919 + 13);
  const n = Math.min(4, Math.floor((now - x.at) / 240_000) + (x.photo ? 1 : 0));
  return Array.from({ length: n }, () => ({ who: CHARACTERS[Math.floor(r() * CHARACTERS.length)].name, text: COMMENTS[Math.floor(r() * COMMENTS.length)] }));
}
const LIKED = new Set();

export function socialApp(g, b, phone) {
  const p = g.profile, now = g.now();
  const followers = followersOf(p);
  const mine = (p.social?.posts || []).slice().reverse();
  const totalLikes = mine.reduce((s, x) => s + likesOf(x, followers, now), 0);
  const handle = `@${p.name.replace(/\s+/g, '').toLowerCase()}`;
  const tab = phone.sgTab || 'feed';
  const setTab = (t) => { phone.sgTab = t; phone.render(); };
  b.classList.add('sg');
  b.append(h('div.sg-head', h('div.sg-avatar', p.name.slice(0, 1).toUpperCase()), h('div.grow', h('b', handle), h('div.sg-stats',
    h('span', h('b', fmt(mine.length)), ' posts'), h('span', h('b', fmt(followers)), ' abonnés'), h('span', h('b', fmt(totalLikes)), ' likes')))));
  // gros bouton appareil photo
  const openCam = () => { phone.close(); openCamera(g, (photo) => { if (photo) composer(g, photo); }); };
  b.append(h('div.sg-actions', h('button.btn.sg-cam', { onclick: openCam }, '📷 Appareil photo'), h('button.btn.ghost', { onclick: () => { phone.close(); composer(g, null); } }, '✏️ Texte')));
  b.append(h('div.sg-tabs', [['feed', '🏠 Fil'], ['me', '👤 Mes posts'], ['gallery', '🖼️ Galerie']].map(([id, n]) => h(`button${tab === id ? '.on' : ''}`, { onclick: () => setTab(id) }, n))));
  if (tab === 'me') {
    if (!mine.length) { b.append(h('p.muted', 'Aucune publication. Prends une photo et partage-la !')); return; }
    b.append(h('div.sg-grid', mine.map((x) => h('div.sg-cell', { onclick: () => { phone.sgOpen = x.id; setTab('feed'); } }, x.photo ? h('img', { src: x.photo, alt: '' }) : h('div.sg-txt', x.text), h('span.sg-l', `❤️ ${fmt(likesOf(x, followers, now))}`)))));
    return;
  }
  if (tab === 'gallery') {
    const gal = loadGallery();
    if (!gal.length) { b.append(h('p.muted', 'Ta galerie est vide : utilise l\'appareil photo !')); return; }
    b.append(h('div.sg-grid', gal.map((x) => h('div.sg-cell', h('img', { src: x.photo, alt: '' }), h('div.sg-cellbtns',
      h('button.btn.small', { onclick: () => { phone.close(); composer(g, x.photo); } }, 'Publier'),
      h('button.btn.small.ghost', { onclick: () => { removeFromGallery(x.at); phone.render(); } }, '🗑'))))));
    return;
  }
  const feed = [
    ...mine.map((x) => ({ who: p.name, role: 'Toi', text: x.text, photo: x.photo, at: x.at, likes: likesOf(x, followers, now), id: x.id, seed: x.seed, filter: x.filter })),
    ...npcFeed(g, now).map((x, k) => ({ ...x, seed: Math.floor(x.at / 1000) + k })),
  ].sort((a, c) => c.at - a.at);
  for (const x of feed) {
    const key = `${x.who}:${Math.floor(x.at)}`, liked = LIKED.has(key);
    const like = () => { if (LIKED.has(key)) LIKED.delete(key); else { LIKED.add(key); g.sfx?.('pop'); } phone.render(); };
    const card = h('div.sg-post', { id: x.id && phone.sgOpen === x.id ? 'sg-open' : null },
      h('div.sg-who', h('div.sg-mini', x.who.slice(0, 1)), h('div', h('b', x.who), h('div.muted', `${x.role} · il y a ${ago(now - x.at)}`))),
      x.photo ? h('img.sg-photo', { src: x.photo, alt: 'photo', ondblclick: like }) : null,
      x.text ? h('div.sg-text', x.photo ? h('b', `${x.who} `) : null, x.text) : null,
      h('div.sg-meta', h('button.sg-like', { onclick: like }, `${liked ? '❤️' : '🤍'} ${fmt(x.likes + (liked ? 1 : 0))}`), h('span.muted', `💬 ${commentsOf(x, now).length}`),
        x.id ? h('button.btn.small.ghost', { onclick: async () => { await g.net.request('social.delete', { id: x.id }); phone.render(); } }, 'Supprimer') : null),
      x.id ? h('div.sg-comments', commentsOf(x, now).map((c) => h('div', h('b', c.who), ` ${c.text}`))) : null);
    b.append(card);
  }
  if (phone.sgOpen) { const el = b.querySelector('#sg-open'); phone.sgOpen = null; setTimeout(() => el?.scrollIntoView({ block: 'start' }), 30); }
}

// Fenêtre de publication : la photo, une légende, publier.
export function composer(g, photo) {
  let text = '';
  const m = g.ui.modal({
    title: '📸 Nouvelle publication', width: 'min(420px, 94vw)', className: 'sg-compose-modal',
    build: (body) => {
      if (photo) body.append(h('img.sg-photo', { src: photo, alt: 'photo' }));
      const ta = h('textarea.input', { maxlength: 140, rows: 2, placeholder: photo ? 'Ajoute une légende... (140 caractères)' : 'Quoi de neuf ?', oninput: (e) => { text = e.target.value; }, onkeydown: (e) => e.stopPropagation() });
      body.append(ta); setTimeout(() => ta.focus(), 40);
    },
    foot: (f) => f.append(h('button.btn.ghost', { onclick: () => m.close() }, 'Annuler'), h('button.btn', { onclick: async () => {
      try { const r = await g.net.request('social.post', { text, photo }); g.sfx('success'); g.ui.toast(`📱 Publié sur PlayGram ! (${fmt(r.followers)} abonnés vont le voir)`, 'good', 4000); m.close(); }
      catch (e) { g.ui.toast(e.message, 'bad'); }
    } }, 'Publier')),
  });
  return m;
}
