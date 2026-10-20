import { h } from '../ui/dom.js';
import { RECIPES, canCook } from '../../shared/recipes.js';

// VIE À LA MAISON : cuisiner (cuisinière + ingrédients + mini-jeu de cuisson), se doucher (douche),
// dormir (lit). Les effets sur les jauges sont décidés par l'autorité (home.use), qui vérifie qu'on
// est bien chez soi, à côté du bon meuble.

const BURNT = ['C\'est... croustillant.', 'J\'ai inventé le charbon comestible !', 'Les pompiers ne sont pas loin, j\'espère ?'];
const PERFECT = ['Un chef étoilé ! ⭐', 'Mamie Turbo serait fière.', 'Je devrais ouvrir un restaurant !'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function use(g, what, extra = {}) {
  try { return await g.net.request('home.use', { what, ...extra }); } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad', 4000); return null; }
}

// Choix de la recette.
export function cookPanel(g) {
  const items = g.net.content.items;
  const m = g.ui.modal({
    title: '🍳 Cuisinière', sub: 'Les ingrédients s\'achètent au supermarché, à la supérette et à la ferme. Ensuite, attention à la cuisson !',
    build: (body) => {
      const inv = g.profile.inventory;
      for (const r of RECIPES) {
        const ok = canCook(r, inv);
        const parts = Object.entries(r.needs).map(([id, n]) => `${items[id]?.emoji || '•'} ${items[id]?.name || id}${n > 1 ? ` ×${n}` : ''} (${inv[id] || 0})`);
        body.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, r.emoji),
          h('div.grow', h('div.t', r.name), h('div.d', parts.join(' · ')), h('div.d', `🍔 +${r.food.faim} · ⚡ +${r.food.energie} · 🙂 +${r.food.humeur}${r.healthy ? ' · 🥦 bon pour la santé' : ''}`)),
          h('button.btn.small', { disabled: !ok, onclick: () => { m.close(); cookingGame(g, r); } }, ok ? 'Cuisiner' : 'Il manque des ingrédients')));
      }
    },
  });
}

// Mini-jeu de cuisson : arrêter l'aiguille dans la zone verte (E, Espace ou clic).
export function cookingGame(g, r) {
  const zone = Math.max(0.1, 0.22 - r.time * 0.06); // demi-largeur de la zone parfaite
  const needle = h('div.cook-needle');
  const bar = h('div.cook-bar', h('div.cook-ok', { style: { left: `${(0.5 - zone * 1.8) * 100}%`, width: `${zone * 3.6 * 100}%` } }), h('div.cook-perfect', { style: { left: `${(0.5 - zone) * 100}%`, width: `${zone * 2 * 100}%` } }), needle);
  const el = h('div.cook-game', h('div.t', `${r.emoji} Cuisson : ${r.name}`), bar, h('div.d', 'Appuie sur E (ou clique) quand l\'aiguille est dans le vert !'));
  g.ui.root.append(el);
  // le mini-jeu prend la main (E ne déclenche plus les interactions, le personnage ne bouge pas)
  const lock = { blocking: true, close: () => { if (!done) { done = true; cleanup(); el.remove(); g.player.setPose('idle'); } } };
  g.ui.stack.push(lock); g.onUiChange?.();
  const cleanup = () => { off(); el.removeEventListener('click', stop); clearInterval(steam); g.ui.stack = g.ui.stack.filter((x) => x !== lock); g.onUiChange?.(); };
  g.player.setPose('cook', 30);
  g.sfx('hiss');
  let x = 0, dir = 1, done = false;
  const speed = 0.9 + r.time * 0.5;
  let last = performance.now();
  const steam = setInterval(() => { const p = g.player.pos; g.fx.emit({ x: p.x + Math.sin(g.player.yaw) * 0.7, y: p.y + 1.1, z: p.z + Math.cos(g.player.yaw) * 0.7, n: 2, colors: ['#ffffff', '#e5e5e5'], speed: 0.8, gravity: -1.5, life: 1, size: 0.25, grow: 1.5 }); }, 220);
  const loop = (now) => {
    if (done) return;
    x += dir * speed * Math.min(0.05, (now - last) / 1000); last = now;
    if (x > 1) { x = 1; dir = -1; } if (x < 0) { x = 0; dir = 1; }
    needle.style.left = `${x * 100}%`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const stop = () => {
    if (done) return;
    done = true;
    cleanup();
    const d = Math.abs(x - 0.5);
    const quality = d <= zone ? 1 : d <= zone * 1.8 ? 0.75 : 0;
    setTimeout(() => el.remove(), 600);
    el.classList.add(quality === 1 ? 'perfect' : quality ? 'ok' : 'burnt');
    finishCooking(g, r, quality);
  };
  const off = g.input.on('key', (e) => { if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') stop(); });
  el.addEventListener('click', stop);
  return { stop, get x() { return x; } };
}

export async function finishCooking(g, r, quality) {
  const res = await use(g, 'cook', { recipe: r.id, quality });
  g.player.setPose('idle');
  if (!res) return;
  const p = g.player.pos;
  if (quality === 0) {
    g.sfx('fail');
    g.fx.emit({ x: p.x + Math.sin(g.player.yaw) * 0.7, y: p.y + 1.2, z: p.z + Math.cos(g.player.yaw) * 0.7, n: 18, colors: ['#2b2b2b', '#4a4a4a'], speed: 1.5, gravity: -2, life: 1.8, size: 0.4, grow: 2 });
    g.labels.bubble(g.avatar.root, pick(BURNT), 3000, 'player');
  } else {
    g.sfx(quality === 1 ? 'success' : 'pop');
    g.eating?.play({ name: r.name });
    if (quality === 1) setTimeout(() => g.labels.bubble(g.avatar.root, pick(PERFECT), 2500, 'player'), 2400);
  }
  g.emit('needs', res.needs);
  g.ui.toast(`${r.emoji} ${r.name} ${quality === 1 ? 'parfait(e) !' : quality ? 'réussi(e)' : 'carbonisé(e)...'} · 🍔 ${Math.round(res.needs.faim)} · ⚡ ${Math.round(res.needs.energie)} · 🙂 ${Math.round(res.needs.humeur)}`, quality ? 'good' : 'bad', 4000);
}

// Douche : petites gouttes, chanson, propreté à 100.
export async function shower(g) {
  const res = await use(g, 'shower');
  if (!res) return;
  showerFx(g);
  g.emit('needs', res.needs);
  g.ui.toast(`🚿 Tout propre ! Tu sens bon le savon à la vanille. · 🧼 ${Math.round(res.needs.hygiene)}`, 'good', 3500);
}

export function showerFx(g) {
  g.sfx('hiss');
  g.labels.bubble(g.avatar.root, pick(['♪ La la la ♪', '♪ Sous la douuuche ♪', 'Ahhh, de l\'eau chaude !']), 2500, 'player');
  let n = 0;
  const iv = setInterval(() => {
    const p = g.player.pos;
    g.fx.emit({ x: p.x, y: p.y + 2.4, z: p.z, n: 6, colors: ['#90e0ef', '#caf0f8', '#ffffff'], speed: 0.4, gravity: 9, life: 0.5, size: 0.06, jitter: 0.35 });
    if (++n > 14) clearInterval(iv);
  }, 200);
}

// Dormir : on s'allonge, Zzz, l'énergie remonte.
export async function sleep(g, seat) {
  const res = await use(g, 'sleep');
  if (!res) return;
  if (seat) g.player.sit({ ...seat, lie: true });
  g.labels.bubble(g.avatar.root, 'Zzzz... 💤', 4000, 'player');
  const dim = h('div', { style: { position: 'absolute', inset: '0', background: '#0b0a2a', opacity: '0', transition: 'opacity 1.2s', zIndex: '30', pointerEvents: 'none' } });
  g.ui.root.append(dim);
  requestAnimationFrame(() => { dim.style.opacity = '0.55'; });
  setTimeout(() => { dim.style.opacity = '0'; setTimeout(() => dim.remove(), 1300); }, 2600);
  g.emit('needs', res.needs);
  g.ui.toast(`😴 Bonne nuit de sommeil ! · ⚡ ${Math.round(res.needs.energie)}`, 'good', 3500);
}
