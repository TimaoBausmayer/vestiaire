import * as THREE from 'three';
import { h, clear } from './dom.js';
import {
  SKINS, HAIR_STYLES, HAIR_LABELS, HAIR_COLORS, EYE_COLORS, EYES, EYE_LABELS, BODIES, COLORS, BASE_TOPS, BASE_BOTTOMS, TOP_LABELS, BOTTOM_LABELS, DEFAULT_APPEARANCE,
} from '../../shared/appearance.js';
import { validName } from '../../shared/rules.js';

// Création / modification du personnage, avec aperçu 3D en direct.
const pickR = (a) => a[Math.floor(Math.random() * a.length)];
const NAMES = ['Patate', 'Zigoto', 'Lulu', 'Moustik', 'Biscotte', 'Kiwi', 'Pépito', 'Nougat', 'Choupette', 'Tornade', 'Gaston', 'Pixel'];

export function randomAppearance() {
  return {
    ...DEFAULT_APPEARANCE, skin: pickR(SKINS.slice(0, 8)), hair: pickR(HAIR_STYLES), hairColor: pickR(HAIR_COLORS), eyes: pickR(EYES),
    body: pickR(BODIES), height: 0.94 + Math.round(Math.random() * 12) / 100, top: pickR(BASE_TOPS), topColor: pickR(COLORS),
    bottom: pickR(BASE_BOTTOMS), bottomColor: pickR(COLORS), shoes: pickR(COLORS),
  };
}

// opts : { appearance, name, askName, extraTops, extraBottoms, onDone(name, appearance), onCancel }
export function openCreator(game, opts) {
  const app = { ...(opts.appearance || randomAppearance()) };
  let name = opts.name || '';
  let startAge = 20;
  const avatar = game.avatar;
  const prevPos = game.player.pos.clone(), prevYaw = game.player.yaw, prevZone = game.player.zone;
  // studio : à la création, devant la fontaine ; en cours de partie, sur place (pas de téléportation,
  // le serveur refuserait un déplacement impossible) : c'est la caméra qui vient au joueur.
  const studio = game.playing ? game.player.pos.clone() : new THREE.Vector3(-6, 0, 22);
  if (!game.playing) game.player.teleport(studio.x, studio.z, 0);
  else { game.player.yaw = 0; game.avatar.root.rotation.y = 0; }
  game.cutscene = true;
  game.player.frozen = true;
  const S = studio;
  game.cam.override = { pos: new THREE.Vector3(S.x - 0.9, S.y + 1.5, S.z + 4.2), look: new THREE.Vector3(S.x + 0.8, S.y + 1.2, S.z) };
  if (innerWidth <= 760) game.cam.override = { pos: new THREE.Vector3(S.x, S.y + 2.6, S.z + 5.5), look: new THREE.Vector3(S.x, S.y + 0.6, S.z) };
  avatar.setAppearance(app);
  let spin = 0;
  const offSpin = game.engine.onUpdate((dt) => { spin += dt * 0.6; avatar.root.rotation.y = Math.sin(spin) * 0.6; });

  const el = h('div.creator');
  const side = h('div.side');
  const body = h('div.panel-body', { style: { flex: '1' } });
  const tabsEl = h('div.tabs');
  let tab = 'corps';
  const TABS = { corps: 'Corps', visage: 'Visage', cheveux: 'Cheveux', tenue: 'Tenue' };
  const apply = () => avatar.setAppearance(app);
  const swatches = (key, list) => h('div.swatches', list.map((c) => h(`button.swatch${app[key] === c ? '.sel' : ''}`, {
    style: { background: c }, 'aria-label': c, onclick: () => { app[key] = c; apply(); render(); },
  })));
  const opts2 = (key, list, labels) => h('div.opt-row', list.map((v) => h(`button.opt${app[key] === v ? '.sel' : ''}`, { onclick: () => { app[key] = v; apply(); render(); } }, labels?.[v] || v)));
  const field = (label, ...c) => h('div.field', h('label', label), ...c);

  function render() {
    clear(tabsEl);
    for (const [k, v] of Object.entries(TABS)) tabsEl.append(h(`button.tab${tab === k ? '.active' : ''}`, { onclick: () => { tab = k; render(); } }, v));
    clear(body);
    if (opts.askName && tab === 'corps') {
      const input = h('input.text-input', { value: name, maxlength: 16, placeholder: 'Ton pseudo (3 à 16 caractères)', oninput: (e) => { name = e.target.value; err.textContent = ''; } });
      body.append(field('Pseudo', input));
    }
    if (tab === 'corps') {
      body.append(field('Couleur de peau', swatches('skin', SKINS)));
      body.append(field('Silhouette', opts2('body', BODIES, { mince: 'Mince', moyen: 'Moyenne', costaud: 'Costaude' })));
      body.append(field('Taille', h('input', { type: 'range', min: 0.9, max: 1.1, step: 0.01, value: app.height, style: { width: '100%' }, oninput: (e) => { app.height = +e.target.value; apply(); } })));
      if (opts.askName) {
        const ageLbl = h('span', `${startAge} ans`);
        body.append(field('Âge de départ (on vieillit en jouant : 6 h de jeu = 1 an)', h('div.row', { style: { gap: '10px', alignItems: 'center' } }, h('input', { type: 'range', min: 16, max: 40, step: 1, value: startAge, style: { flex: '1' }, oninput: (e) => { startAge = +e.target.value; ageLbl.textContent = `${startAge} ans`; } }), ageLbl)));
      }
    } else if (tab === 'visage') {
      body.append(field('Regard', opts2('eyes', EYES, EYE_LABELS)));
    } else if (tab === 'cheveux') {
      if (opts.noHair) body.append(h('p', '✂️ Pour changer de coupe ou de couleur, va au Salon Tifs & Brushing (Quartier des Tilleuls) !'));
      else {
        body.append(field('Coiffure', opts2('hair', HAIR_STYLES, HAIR_LABELS)));
        body.append(field('Couleur', swatches('hairColor', HAIR_COLORS)));
        body.append(field('Couleur des yeux', swatches('eyeColor', EYE_COLORS)));
      }
    } else if (tab === 'tenue') {
      const tops = [...BASE_TOPS, ...(opts.extraTops || [])];
      const bottoms = [...BASE_BOTTOMS, ...(opts.extraBottoms || [])];
      const labels = { ...TOP_LABELS, ...BOTTOM_LABELS, ...(opts.labels || {}) };
      body.append(field('Haut', opts2('top', tops, labels)), field('Couleur du haut', swatches('topColor', COLORS)));
      body.append(field('Bas', opts2('bottom', bottoms, labels)), field('Couleur du bas', swatches('bottomColor', COLORS)));
      body.append(field('Chaussures', swatches('shoes', COLORS)));
    }
  }
  const err = h('div', { style: { color: '#ff8fa3', fontWeight: '700', minHeight: '18px' } });
  const close = () => {
    offSpin();
    el.remove();
    game.cam.override = null;
    game.cutscene = false;
    game.player.frozen = false;
  };
  const restore = () => { game.player.zone = prevZone; game.player.yaw = prevYaw; if (!game.playing) game.player.teleport(prevPos.x, prevPos.z, prevYaw, prevPos.y); };
  const foot = h('div.panel-foot',
    err,
    h('button.btn.ghost', { onclick: () => { Object.assign(app, randomAppearance()); if (opts.askName && !name) name = pickR(NAMES) + Math.floor(Math.random() * 90 + 10); apply(); render(); } }, '🎲 Au hasard'),
    opts.onCancel ? h('button.btn.ghost', { onclick: () => { close(); restore(); opts.onCancel(); } }, 'Annuler') : null,
    h('button.btn', {
      onclick: async () => {
        if (opts.askName) { const bad = validName(name); if (bad) { err.textContent = bad; return; } }
        try {
          await opts.onDone(name.trim(), { ...app }, { age: startAge });
          close();
          if (!opts.askName) restore();
        } catch (e) { err.textContent = e.message; }
      },
    }, opts.askName ? 'C\'est parti !' : 'Enregistrer'));
  side.append(h('div.panel-head', h('h2', opts.askName ? 'Crée ton personnage' : 'Modifier mon look', h('span.sub', 'Tout est modifiable plus tard depuis le téléphone.'))), tabsEl, body, foot);
  el.append(h('div'), side);
  game.ui.root.append(el);
  render();
}
