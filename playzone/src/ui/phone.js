import * as THREE from 'three';
import { h, clear, fmt } from './dom.js';
import { drawMapBase, drawMarkers, drawRoute, MAP_PX } from './hud.js';
import { WORLD_BOUNDS, SECRETS, POI } from '../../shared/world-layout.js';
import { destinations, DEST_CATS } from './gps.js';
import { JOBS, jobLevel } from '../../shared/content/jobs.js';
import { levelProgress } from '../../shared/rules.js';
import { ROADMAP } from '../../shared/content/roadmap.js';
import { garagePanel } from '../vehicles/vehicles.js';
import { bankApp } from '../property/bank.js';
import { workApp } from '../career/career.js';
import { businessApp } from '../career/business.js';
import { healthApp } from '../life/body.js';
import { papersApp } from '../police/panels.js';
import { helpApp } from './tutorial.js';
import { agendaApp } from '../events/agenda.js';
import { socialApp } from './social-app.js';
import { adminApp } from './admin.js';
import { premiumApp } from './premium-app.js';
import { openWardrobe } from './shop.js';
import { formatHour } from '../world/daynight.js';

// TÉLÉPHONE VIRTUEL : carte, missions, animaux, garage, sac, événements, messages, amis, profil,
// saison (mises à jour), réglages. Touche P (ou bouton 📱).
const APPS = [
  { id: 'map', name: 'Carte', icon: '🗺️', bg: '#2ec4b6' },
  { id: 'missions', name: 'Missions', icon: '📋', bg: '#ffd23f' },
  { id: 'pets', name: 'Animaux', icon: '🐾', bg: '#ff9f1c' },
  { id: 'garage', name: 'Garage', icon: '🛵', bg: '#3d8ee8' },
  { id: 'bank', name: 'Banque', icon: '🏦', bg: '#2a9d8f' },
  { id: 'work', name: 'Travail', icon: '💼', bg: '#6c757d' },
  { id: 'business', name: 'Business', icon: '📈', bg: '#14213d' },
  { id: 'health', name: 'Santé', icon: '❤️', bg: '#ff4d6d' },
  { id: 'papers', name: 'Papiers', icon: '🪪', bg: '#1d3557' },
  { id: 'help', name: 'Aide', icon: '📘', bg: '#4ea8de' },
  { id: 'social', name: 'PlayGram', icon: '📸', bg: '#ff3fa4' },
  { id: 'urgences', name: 'Urgences', icon: '🚨', bg: '#d62828' },
  { id: 'premium', name: 'Boutique', icon: '💎', bg: '#7b2cbf' },
  { id: 'admin', name: 'Admin', icon: '👑', bg: '#d4a017', admin: true },
  { id: 'bag', name: 'Sac', icon: '🎒', bg: '#7ac74f' },
  { id: 'code', name: 'Espace code', icon: '🔐', bg: '#2b2d42', hidden: true },
  { id: 'events', name: 'Agenda', icon: '📅', bg: '#ff5a5f' },
  { id: 'messages', name: 'Messages', icon: '💬', bg: '#5fd068' },
  { id: 'friends', name: 'Joueurs', icon: '👥', bg: '#8b5cf6' },
  { id: 'profile', name: 'Profil', icon: '🏆', bg: '#c77dff' },
  { id: 'season', name: 'Saison', icon: '📅', bg: '#ff8c1a' },
  { id: 'settings', name: 'Réglages', icon: '⚙️', bg: '#9aa5b1' },
];

export class Phone {
  constructor(game) {
    this.game = game;
    this.el = null;
    this.app = null;
    this.mapBase = game.hud?.mapBase || drawMapBase(MAP_PX);
    this.badges = {};
    game.on('profile', () => { if (this.el && this.app && this.app !== 'map') this.render(); });
  }

  get isOpen() { return !!this.el; }
  toggle() { if (this.el) this.close(); else this.open(); }

  open(app = null) {
    const g = this.game;
    if (!this.el) {
      this.screen = h('div.phone-screen');
      this.status = h('div.phone-status');
      this.el = h('div.phone', this.status, this.screen, h('div.phone-home', { onclick: () => (this.app ? this.go(null) : this.close()) }));
      this.modal = { el: this.el, blocking: false, close: () => this.close() };
      g.ui.stack.push(this.modal);
      g.ui.root.append(this.el);
      g.sfx('click');
      // le personnage sort son téléphone
      if (!this.mesh) {
        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.17, 0.02), new THREE.MeshStandardMaterial({ color: '#14141c', emissive: '#29e6ff', emissiveIntensity: 0.35 }));
        this.mesh.rotation.x = -Math.PI / 2;
      }
      g.avatar?.hold(this.mesh);
      if (g.player) g.player.onPhone = true;
    }
    this.go(app);
  }

  close() {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    if (this.game.avatar?.held === this.mesh) this.game.avatar.hold(null);
    if (this.game.player) this.game.player.onPhone = false;
    this.game.ui.stack = this.game.ui.stack.filter((m) => m !== this.modal);
    this.game.onUiChange?.();
  }

  go(app) { this.app = app; this.badges[app] = 0; this.render(); }

  badge(app, n = 1) { this.badges[app] = (this.badges[app] || 0) + n; this.game.hud.phoneDot?.classList.toggle('hidden', !Object.values(this.badges).some((x) => x > 0)); }

  render() {
    const g = this.game;
    clear(this.status);
    // barre d'état façon smartphone : heure, Dynamic Island, réseau, wifi, batterie
    const online = g.net.mode !== 'solo';
    const bat = Math.max(8, Math.round(100 - ((g.now() / 60000) % 90)));
    this.status.append(h('span.ps-time', formatHour(g.world.dayNight.hour)), h('span.ps-island'),
      h('span.ps-right', h('span.ps-bars', [1, 2, 3, 4].map((k) => h(`i${online || k < 3 ? '.on' : ''}`))), h('span.ps-wifi', online ? '📶' : '✈️'), h('span.ps-bat', h('i', { style: { width: `${bat}%` } }), h('b', String(bat)))));
    clear(this.screen);
    this.el.classList.toggle('home', !this.app);
    if (!this.app) {
      const day = g.world.dayNight.day || '', hr = formatHour(g.world.dayNight.hour);
      const icon = (a) => h('button.app-icon', { onclick: () => this.go(a.id) }, h('span.ic', { style: { background: `linear-gradient(160deg, ${a.bg}, ${a.bg}cc)` } }, a.icon), h('span.nm', a.name), this.badges[a.id] ? h('span.dot', String(this.badges[a.id])) : null);
      const dockIds = ['map', 'bank', 'social', 'urgences'];
      const apps = APPS.filter((a) => !a.hidden && (!a.admin || this.game.profile.admin));
      this.screen.append(
        h('div.ph-widget', h('div.big', hr), h('div.sub', `${day} · ${fmt(g.profile.coins)} PC · ${online ? 'En ligne' : 'Solo'}`)),
        h('div.phone-apps', apps.filter((a) => !dockIds.includes(a.id)).map(icon)),
        h('button.code-space', { onclick: () => this.go('code') }, '🔐 Espace code'),
        h('div.ph-dock', apps.filter((a) => dockIds.includes(a.id)).map(icon)));
      return;
    }
    const app = APPS.find((a) => a.id === this.app);
    const body = h('div');
    this.screen.append(h('div.phone-bar', { style: { margin: '-52px -16px 12px', paddingTop: '54px', position: 'sticky', top: '-52px', zIndex: 2 } }, h('button.close-x', { onclick: () => this.go(null) }, '‹'), h('h3', `${app.icon} ${app.name}`)), body);
    this[`app_${this.app}`]?.(body);
  }

  // ------------------------------------------------------------------ applis
  app_map(b) {
    const g = this.game;
    // champ « code » discret en bas de la carte (mode admin)
    setTimeout(() => {
      if (!this.el || this.app !== 'map') return;
      let code = '';
      b.append(h('div.map-code', h('input.input', { type: 'password', placeholder: 'Code…', autocomplete: 'off', oninput: (e) => { code = e.target.value; }, onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); } }), h('button.btn.small.ghost', { onclick: () => go() }, 'OK')));
      const go = async () => {
        try { await g.net.request('admin.unlock', { code }); g.sfx('levelup'); g.ui.toast('👑 Mode admin activé ! Appli Admin dans le téléphone.', 'good', 5000); this.go('admin'); } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
      };
    }, 0);
    const B = WORLD_BOUNDS, MW = B.maxX - B.minX, MH = B.maxZ - B.minZ;
    const c = h('canvas', { width: 600, height: 600 });
    // vue : centre (monde) + zoom (pixels par mètre)
    const P0 = g.player.zone === 'world' ? g.player.pos : POI.homeDoor;
    const view = this.mapView ||= { x: P0.x, z: P0.z, k: 1.6 };
    if (this.mapFollow !== false) { view.x = P0.x; view.z = P0.z; }
    const toScreen = (wx, wz) => [300 + (wx - view.x) * view.k, 300 + (wz - view.z) * view.k];
    const toWorld = (sx, sy) => [view.x + (sx - 300) / view.k, view.z + (sy - 300) / view.k];
    const info = h('p.muted', { style: { fontSize: '12px', margin: '6px 0' } }, 'Glisse pour te déplacer, molette / boutons pour zoomer. Touche un lieu pour lancer le GPS.');
    const zoom = (f) => { view.k = Math.max(0.5, Math.min(6, view.k * f)); };
    b.append(h('div.bigmap', c), h('div.row', { style: { gap: '6px', margin: '6px 0' } },
      h('button.btn.small.ghost', { onclick: () => zoom(1.4) }, '➕'), h('button.btn.small.ghost', { onclick: () => zoom(1 / 1.4) }, '➖'),
      h('button.btn.small.ghost', { onclick: () => { this.mapFollow = true; const p = g.player.pos; view.x = p.x; view.z = p.z; } }, '🎯 Moi'),
      h('button.btn.small.ghost', { onclick: () => { view.x = (B.minX + B.maxX) / 2; view.z = (B.minZ + B.maxZ) / 2; view.k = 600 / Math.max(MW, MH); this.mapFollow = false; } }, '🗺️ Tout'),
      g.gps?.dest ? h('button.btn.small', { onclick: () => { g.hud.compassTarget = null; g.gps.clear(); this.render(); } }, '✖ Arrêter le GPS') : null), info);
    const draw = () => {
      if (!c.isConnected) return;
      const x = c.getContext('2d');
      x.fillStyle = '#2e9fd6'; x.fillRect(0, 0, 600, 600);
      const [ox, oy] = toScreen(B.minX, B.minZ);
      x.drawImage(this.mapBase, ox, oy, MW * view.k, MH * view.k);
      drawRoute(x, toScreen, g.gps?.route, 1.2);
      const markers = [...g.mapMarkers()];
      if (g.gps?.dest) markers.push({ x: g.gps.dest.x, z: g.gps.dest.z, color: '#29e6ff', icon: '📍' });
      drawMarkers(x, toScreen, markers, Math.max(1, Math.min(1.8, view.k)));
      const pp = g.player.zone === 'world' ? g.player.pos : POI.homeDoor;
      const [px, pz] = toScreen(pp.x, pp.z);
      x.save(); x.translate(px, pz); x.rotate(-g.player.yaw + Math.PI);
      x.fillStyle = '#fff'; x.strokeStyle = '#ff5a5f'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(0, -11); x.lineTo(8, 8); x.lineTo(0, 4); x.lineTo(-8, 8); x.closePath(); x.fill(); x.stroke();
      x.restore();
      if (view.k > 2.2) { // noms des lieux de près
        x.font = '600 11px system-ui'; x.fillStyle = '#1b1446'; x.textAlign = 'center';
        for (const d of destinations()) { const [sx, sy] = toScreen(d.x, d.z); if (sx > 0 && sx < 600 && sy > 0 && sy < 600) x.fillText(d.name.slice(0, 26), sx, sy + 16); }
      }
      requestAnimationFrame(() => setTimeout(draw, 200));
    };
    draw();
    // déplacement / zoom
    let drag = null, moved = 0;
    const scale = () => 600 / c.getBoundingClientRect().width;
    c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; moved = 0; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.x) * scale(), dy = (e.clientY - drag.y) * scale();
      moved += Math.abs(dx) + Math.abs(dy);
      view.x -= dx / view.k; view.z -= dy / view.k; drag = { x: e.clientX, y: e.clientY };
      if (moved > 6) this.mapFollow = false;
    });
    c.addEventListener('pointerup', (e) => {
      const wasDrag = moved > 6;
      drag = null;
      if (wasDrag) return;
      const r = c.getBoundingClientRect();
      const [wx, wz] = toWorld((e.clientX - r.left) * scale(), (e.clientY - r.top) * scale());
      // lieu le plus proche du point touché
      let best = null, bd = 14 / view.k + 6;
      for (const d of destinations()) { const dd = Math.hypot(d.x - wx, d.z - wz); if (dd < bd) { bd = dd; best = d; } }
      this.goTo(best || { x: wx, z: wz, name: 'Repère' });
    });
    c.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    // liste des lieux (recherche + catégories)
    const search = h('input', { type: 'search', placeholder: 'Rechercher un lieu (pizzeria, police, garage...)', style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: 'none', margin: '6px 0' } });
    const list = h('div.list');
    const fill = () => {
      clear(list);
      const q = search.value.trim().toLowerCase();
      const all = destinations(this.game.profile).filter((d) => !q || d.name.toLowerCase().includes(q));
      for (const [cat, label] of Object.entries(DEST_CATS)) {
        const items = all.filter((d) => d.cat === cat);
        if (!items.length) continue;
        list.append(h('h4', { style: { margin: '10px 0 4px' } }, label));
        const P = g.player.pos;
        items.sort((a2, b2) => Math.hypot(a2.x - P.x, a2.z - P.z) - Math.hypot(b2.x - P.x, b2.z - P.z));
        for (const d of items) list.append(h('div.list-item', { style: { cursor: 'pointer' }, onclick: () => this.goTo(d) }, h('div.grow', h('div.t', d.name), h('div.d', `${Math.round(Math.hypot(d.x - P.x, d.z - P.z))} m à vol d'oiseau`)), h('span.pill', 'GPS')));
      }
    };
    search.addEventListener('input', fill);
    b.append(h('h4', { style: { margin: '10px 0 0' } }, '🧭 Aller à...'), search, list);
    fill();
  }

  goTo(d) {
    const g = this.game;
    g.hud.compassTarget = { x: d.x, z: d.z, label: d.name, manual: true };
    g.gps?.set({ x: d.x, z: d.z, label: d.name, manual: true });
    g.ui.toast(`🧭 GPS : itinéraire vers ${d.name} (${Math.round(g.gps?.remaining() || 0)} m). Suis la ligne bleue !`, 'good', 3500);
    this.close();
  }

  app_missions(b) {
    const g = this.game, p = g.profile;
    const a = g.jobs?.active;
    b.append(h('div.list-item', h('div.grow', h('div.t', a ? `${a.job.emoji} En mission : ${a.mt.name}` : 'Aucune mission en cours'), h('div.d', a ? 'Suis la boussole et les balises lumineuses.' : 'Va à un poste de travail (icônes 📦 🚒 🍔 sur la carte).')),
      a ? h('button.btn.small.ghost', { onclick: () => g.jobs.cancel() }, 'Abandonner') : null));
    b.append(h('h4', { style: { margin: '14px 0 6px' } }, 'Métiers'));
    b.append(h('div.list', JOBS.map((j) => h('div.list-item', h('span', { style: { fontSize: '24px' } }, j.emoji), h('div.grow', h('div.t', `${j.name} · niveau ${jobLevel(p.jobs[j.id].xp)}`), h('div.d', `${p.jobs[j.id].missions} missions · ${p.jobs[j.id].upgrades.length}/${j.upgrades.length} améliorations`))))));
    b.append(h('h4', { style: { margin: '14px 0 6px' } }, 'Mini-jeux'));
    b.append(h('div.list', g.minigames.list.map((m) => { const st = p.minigames[m.def.id]; return h('div.list-item', h('span', { style: { fontSize: '24px' } }, m.def.emoji), h('div.grow', h('div.t', m.def.name), h('div.d', st?.best != null ? `Record : ${m.scoreLabel(st.best)} · ${st.plays} parties` : 'Jamais joué'))); })));
    b.append(h('h4', { style: { margin: '14px 0 6px' } }, 'Objectifs'));
    b.append(h('div.list',
      h('div.list-item', h('span', '🦆'), h('div.grow', h('div.t', `Canards dorés : ${p.secrets.length}/${SECRETS.length}`), h('div.d', 'Demande des indices à Gérard, sur la Grande Place.'))),
      h('div.list-item', h('span', '🎁'), h('div.grow', h('div.t', `Bonus quotidien : série de ${p.daily.streak} jour${p.daily.streak > 1 ? 's' : ''}`), h('div.d', 'Reviens chaque jour pour l\'augmenter.'))),
      h('div.list-item', h('span', '👑'), h('div.grow', h('div.t', 'Couronne du Quartier'), h('div.d', 'Niveau 10 + 200 de réputation + 5 000 PC. Bonne chance !')))));
  }

  app_pets(b) { b.append(h('button.btn.block', { onclick: () => { this.close(); this.game.pets.openPanel(); } }, '🐾 Ouvrir la fiche de mes animaux')); b.append(h('p.muted', 'Astuce : approche-toi de ton animal et appuie sur E pour t\'en occuper.')); }

  app_garage(b) { garagePanel(this.game, b, () => this.render()); }

  app_bank(b) { bankApp(this.game, b, () => this.render()); }

  app_work(b) { workApp(this.game, b); }

  app_business(b) { businessApp(this.game, b, () => this.render()); }

  app_health(b) { healthApp(this.game, b); }

  app_papers(b) { papersApp(this.game, b); }

  app_help(b) { helpApp(this.game, b); }
  app_social(b) { socialApp(this.game, b, this); }
  app_admin(b) { adminApp(this.game, b, this); }
  app_urgences(b) { this.game.emergencies?.app(b, this); }
  app_premium(b) { premiumApp(this.game, b); }

  // Espace code : on tape un code secret (mode admin...).
  app_code(b) {
    const g = this.game;
    if (g.profile.admin) b.append(h('p', '👑 Le mode admin est déjà activé.'), h('button.btn.block', { onclick: () => this.go('admin') }, 'Ouvrir l\'appli Admin'));
    let code = '';
    const go = async () => {
      try { await g.net.request('admin.unlock', { code }); g.sfx('levelup'); g.ui.toast('👑 Code accepté : mode admin activé !', 'good', 5000); this.go('admin'); }
      catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
    };
    const inp = h('input.input', { type: 'password', placeholder: 'Entre ton code', autocomplete: 'off', oninput: (e) => { code = e.target.value; }, onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); } });
    b.append(h('p.muted', 'Tape ton code secret puis valide.'), inp, h('button.btn.block', { style: { marginTop: '8px' }, onclick: go }, 'Valider'));
    setTimeout(() => inp.focus(), 60);
  }

  app_bag(b) {
    const g = this.game, p = g.profile, items = g.net.content.items;
    const owned = Object.keys(p.inventory).filter((k) => p.inventory[k] > 0 && items[k]);
    b.append(h('button.btn.block', { onclick: () => { this.close(); openWardrobe(g); } }, '👕 Ouvrir la garde-robe'));
    if (!owned.length) { b.append(h('p.muted', 'Ton sac est vide. Les boutiques sont sur la Grande Place !')); return; }
    const st = g.life?.status;
    if (st) b.append(h('p.muted', `🍔 Faim ${Math.round(st.faim)} · ⚡ Énergie ${Math.round(st.energie)} · 🙂 Humeur ${Math.round(st.humeur)} · 🧼 Propreté ${Math.round(st.hygiene)}`));
    const eat = async (k) => {
      try { const r = await g.net.request('food.eat', { itemId: k }); this.close(); g.eating?.play(items[k]); g.emit('needs', r.needs); } catch (e) { g.ui.toast(e.message, 'bad'); }
    };
    const group = (title, f, action) => { const list = owned.filter((k) => f(items[k])); if (list.length) b.append(h('h4', { style: { margin: '14px 0 6px' } }, title), h('div.list', list.map((k) => h('div.list-item', h('span', { style: { fontSize: '22px' } }, items[k].emoji), h('div.grow', h('div.t', items[k].name), items[k].food ? h('div.d', `🍔 +${items[k].food.faim} · ⚡ ${items[k].food.energie} · 🙂 ${items[k].food.humeur}`) : null), h('span.pill', `x${p.inventory[k]}`), action ? h('button.btn.small', { onclick: () => action(k) }, action === eat ? 'Manger' : 'Utiliser') : null)))); };
    group('Nourriture et boissons', (it) => !!it.food && !it.ingredient, eat);
    group('Ingrédients (à cuisiner chez soi, sur une cuisinière)', (it) => !!it.ingredient);
    const care = async (k) => { const it = items[k]; try { if (it.perfume) { await g.net.request('perfume.use', { itemId: k }); g.ui.toast(`${it.emoji} Pschitt ! Tu sens divinement bon (+ attirance).`, 'good'); } else { const r = await g.net.request('body.heal', { itemId: k }); g.ui.toast(`${it.emoji} Santé : ${Math.round(r.health)}`, 'good'); } } catch (e) { g.ui.toast(e.message, 'bad'); } };
    group('Parfums et soins', (it) => !!(it.perfume || it.heal), care);
    group('Vêtements et accessoires', (it) => !!it.slot);
    group('Meubles', (it) => !!it.furniture);
    group('Autres consommables', (it) => !!it.consumable && !it.food);
  }

  app_events(b) { agendaApp(this.game, b, this); }

  app_messages(b) {
    const g = this.game;
    if (g.net.mode === 'solo') { b.append(h('p', 'Les messages, invitations et le chat fonctionnent en ligne (avec le serveur PLAYZONE).'), h('p.muted', 'En solo, les habitants te parlent directement dans la rue !')); return; }
    const inbox = g.social?.inbox || [];
    if (!inbox.length) b.append(h('p.muted', 'Aucun message. Utilise le chat (Entrée) pour parler aux joueurs proches.'));
    b.append(h('div.list', inbox.slice().reverse().map((m) => h('div.list-item', h('div.grow', h('div.t', m.title), h('div.d', m.text)), ...(m.actions || []).map((a) => h('button.btn.small', { onclick: () => { a.run(); this.render(); } }, a.label))))));
  }

  app_friends(b) {
    const g = this.game;
    if (g.net.mode === 'solo') { b.append(h('p', 'La liste des joueurs connectés, les groupes et les invitations chez toi sont disponibles en ligne.')); return; }
    g.social?.renderPlayers(b, () => this.render());
  }

  app_profile(b) {
    const g = this.game, p = g.profile;
    const lp = levelProgress(p.xp);
    b.append(h('div', { style: { textAlign: 'center', margin: '6px 0 12px' } }, h('div', { style: { fontSize: '24px', fontWeight: '900' } }, p.name), h('div.muted', p.titles.length ? p.titles.join(' · ') : 'Habitant de PLAYZONE')));
    b.append(h('div.stat-grid',
      h('div.stat', h('b', `Niv. ${lp.level}`), h('span', `${Math.round(lp.ratio * 100)} % vers le suivant`)),
      h('div.stat', h('b', fmt(p.rep)), h('span', 'Réputation')),
      h('div.stat', h('b', fmt(p.stats.earned)), h('span', 'PC gagnés')),
      h('div.stat', h('b', fmt(p.stats.spent)), h('span', 'PC dépensés')),
      h('div.stat', h('b', String(p.stats.deliveries || 0)), h('span', 'Colis livrés')),
      h('div.stat', h('b', String(p.stats.fires || 0)), h('span', 'Feux éteints')),
      h('div.stat', h('b', String(p.stats.burgers || 0)), h('span', 'Burgers parfaits')),
      h('div.stat', h('b', String(p.pets.length)), h('span', 'Animaux'))));
    b.append(h('button.btn.ghost.block', { style: { marginTop: '12px' }, onclick: () => { this.close(); g.editLook(); } }, '✂️ Modifier mon apparence'));
  }

  app_season(b) {
    const c = this.game.net.content;
    const seasonal = c.packs.filter((p) => p.start);
    b.append(h('h4', { style: { margin: '0 0 6px' } }, 'En ce moment'));
    if (seasonal.length) for (const p of seasonal) b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, '🎃'), h('div.grow', h('div.t', p.name), h('div.d', `Jusqu'au ${new Date(p.end).toLocaleDateString('fr-FR')} · version ${p.version}`))));
    else b.append(h('p.muted', 'Pas de saison spéciale en ce moment.'));
    b.append(h('h4', { style: { margin: '14px 0 6px' } }, 'Calendrier des mises à jour'));
    b.append(h('div.list', ROADMAP.map((r) => h('div.list-item', h('div.grow', h('div.t', `${new Date(`${r.month}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} · ${r.title}`), h('div.d', r.items.join(' · '))), h(`span.pill${r.status === 'live' ? '.ok' : '.warn'}`, r.status === 'live' ? 'disponible' : 'prévu')))));
  }

  app_settings(b) {
    const g = this.game;
    const q = h('div.opt-row', ['low', 'medium', 'high'].map((v) => h(`button.opt${g.engine.quality === v ? '.sel' : ''}`, { onclick: () => { g.engine.setQuality(v); this.render(); } }, { low: 'Léger', medium: 'Moyen', high: 'Élevé' }[v])));
    b.append(h('div.field', h('label', 'Graphismes'), q));
    b.append(h('div.field', h('label', 'Son'), h('button.btn.small.ghost', { onclick: () => { g.sound.setMuted(!g.sound.muted); this.render(); } }, g.sound.muted ? '🔇 Activer le son' : '🔊 Couper le son')));
    if (g.net.mode === 'solo') {
      b.append(h('div.field', h('label', 'Sauvegarde (solo)'),
        h('button.btn.small', { onclick: () => { const blob = new Blob([g.net.exportSave()], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: `playzone-${g.profile.name}.json` }); a.click(); } }, '💾 Exporter ma sauvegarde'),
        h('label.btn.small.ghost', { style: { marginTop: '6px' } }, '📂 Importer', h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: async (e) => { try { g.net.importSave(await e.target.files[0].text()); g.ui.toast('Sauvegarde importée !', 'good'); } catch (err) { g.ui.toast(err.message, 'bad'); } } }))));
    } else b.append(h('p.muted', 'En ligne, ta progression est sauvegardée sur le serveur.'));
    b.append(h('div.field', h('label', 'Commandes'), h('div.muted', { style: { fontSize: '13px', lineHeight: '1.6' } },
      'ZQSD / WASD / flèches : bouger · Maj : courir · Espace : sauter · E : interagir · P : téléphone · M : carte · Entrée : chat · 1 2 3 : danser · 4 : saluer · F ou clic maintenu : lance à incendie · H : klaxon · Glisser : caméra · Molette : zoom')));
    b.append(h('p.muted', { style: { fontSize: '12px' } }, `PLAYZONE ${g.net.content.packs.map((p) => `${p.id}@${p.version}`).join(' + ')}`));
  }
}
