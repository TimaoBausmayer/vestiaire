import * as THREE from 'three';
import { h, fmt } from '../ui/dom.js';
import { StaticBuilder } from '../core/static-builder.js';
import { MATS } from '../core/materials.js';
import { Avatar } from '../characters/avatar.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS, COLORS } from '../../shared/appearance.js';
import { liveOf, CAL_BY_ID, minutesUntil } from '../../shared/calendar.js';
import { marketStalls, VENDORS, STALL_R } from '../../shared/market.js';
import { mulberry32, hashString } from '../../shared/rng.js';
import { payRow, getPay } from '../ui/shop.js';
import { calNow } from './agenda.js';

// MARCHÉS : quand le créneau du calendrier commence, les stands s'installent sur la Grande Place,
// les vendeurs arrivent, des habitants flânent entre les stands. Achats et négociation réels.

const OFFERS = [0.05, 0.1, 0.15, 0.2, 0.3];

function lookFor(seed) {
  const r = mulberry32(hashString(seed));
  const pick = (a) => a[Math.floor(r() * a.length)];
  return { ...DEFAULT_APPEARANCE, skin: pick(SKINS.slice(0, 8)), hair: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS.slice(0, 7)), topColor: pick(COLORS), bottomColor: pick(['#2b2d42', '#3d8ee8', '#7a5230']), top: pick(['tshirt', 'chemise', 'pull']) };
}

export class Markets {
  constructor(g) {
    this.g = g;
    this.cur = null;     // { occ, market, stalls, group, vendors, shoppers, inters }
    this.t = 0;
  }

  update(dt) {
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 2;
      const o = liveOf((e) => e.kind === 'market', calNow(this.g))[0] || null;
      if ((o?.occ || null) !== (this.cur?.occ || null)) { this.teardown(); if (o) this.setup(o); }
    }
    if (this.cur) this.animate(dt);
  }

  setup(o) {
    const g = this.g, ev = CAL_BY_ID[o.id];
    const stalls = marketStalls(o.occ, ev.market, g.net.content.items);
    const sb = new StaticBuilder(Infinity);
    const colliders = [];
    for (const st of stalls) {
      const V = VENDORS[st.vendor], s = st.slot;
      const c = Math.cos(s.ry), sn = Math.sin(s.ry);
      const L = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
      const box = (lx, y, lz, w, hh, d, col, mat) => { const [x, z] = L(lx, lz); sb.box(x, y, z, w, hh, d, col, s.ry, mat); };
      box(0, 0, 0, 3.2, 0.95, 1.1, '#a0703c');                         // étal
      box(0, 0.95, 0, 3.3, 0.06, 1.2, '#e9e4da');
      for (const lx of [-1.5, 1.5]) for (const lz of [-0.9, 0.5]) box(lx, 0, lz, 0.1, 2.5, 0.1, '#6b4f3a');
      for (let i = 0; i < 6; i++) box(-1.375 + i * 0.55, 2.5, -0.2, 0.55, 0.08, 1.9, i % 2 ? V.color : '#ffffff'); // toile rayée
      for (let i = 0; i < st.items.length; i++) box(-1.2 + i * 0.6, 1.0, 0.15, 0.45, 0.3, 0.45, ['#e63946', '#ffd23f', '#7ac74f', '#3d8ee8', '#ff9f1c'][i % 5]); // cagettes
      const [cx, cz] = L(0, 0);
      const w = Math.abs(c) * 3.2 + Math.abs(sn) * 1.1, d = Math.abs(sn) * 3.2 + Math.abs(c) * 1.1;
      colliders.push(g.collision.addBox(cx - w / 2, 0, cz - d / 2, cx + w / 2, 1, cz + d / 2));
    }
    const group = sb.build(MATS);
    group.scale.y = 0.01; // les stands « s'installent »
    g.engine.scene.add(group);
    // vendeurs derrière leur étal, interactions devant
    const vendors = [], inters = [];
    for (const st of stalls) {
      const V = VENDORS[st.vendor], s = st.slot;
      const bx = s.x - Math.sin(s.ry) * 1.2, bz = s.z - Math.cos(s.ry) * 1.2;
      const av = new Avatar(lookFor(st.id), {});
      av.root.position.set(bx, 0.05, bz); av.root.rotation.y = s.ry;
      g.engine.scene.add(av.root);
      const label = document.createElement('div');
      label.className = 'wlabel';
      label.textContent = `${V.emoji} ${V.name}`;
      const lab = g.labels.add(av.root, label, 2.35, 25);
      vendors.push({ av, lab });
      const fx = s.x + Math.sin(s.ry) * 1.6, fz = s.z + Math.cos(s.ry) * 1.6;
      inters.push(g.interactions.add({ x: fx, z: fz, r: 2.2, priority: 2, label: `🛒 Stand : ${V.name}`, action: () => stallPanel(g, o, st) }));
    }
    // flâneurs (PNJ) qui vont d'un stand à l'autre
    const shoppers = [];
    for (let i = 0; i < 6; i++) {
      const av = new Avatar(lookFor(`${o.occ}-flaneur-${i}`), {});
      const st = stalls[i % stalls.length].slot;
      av.root.position.set(st.x * 0.6, 0.05, st.z * 0.6 + 6);
      g.engine.scene.add(av.root);
      shoppers.push({ av, target: null, wait: Math.random() * 3 });
    }
    this.cur = { occ: o.occ, ev, stalls, group, colliders, vendors, inters, shoppers, grow: 0 };
    g.ui.toast(`${ev.emoji} ${ev.name} : les stands s'installent sur la Grande Place !`, 'event', 5000);
  }

  animate(dt) {
    const c = this.cur;
    if (c.grow < 1) { c.grow = Math.min(1, c.grow + dt * 0.6); c.group.scale.y = 0.01 + 0.99 * (1 - (1 - c.grow) ** 3); }
    for (const v of c.vendors) v.av.update(dt, { speed: 0, grounded: true, pose: 'idle' });
    for (const s of c.shoppers) {
      const p = s.av.root.position;
      if (!s.target) {
        s.wait -= dt;
        s.av.update(dt, { speed: 0, grounded: true, pose: 'idle' });
        if (s.wait <= 0) { const st = c.stalls[Math.floor(Math.random() * c.stalls.length)].slot; s.target = { x: st.x + Math.sin(st.ry) * 2.4 + (Math.random() - 0.5), z: st.z + Math.cos(st.ry) * 2.4 + (Math.random() - 0.5) }; }
        continue;
      }
      const dx = s.target.x - p.x, dz = s.target.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { s.target = null; s.wait = 3 + Math.random() * 5; continue; }
      const sp = 1.3;
      p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt;
      s.av.root.rotation.y = Math.atan2(dx, dz);
      s.av.update(dt, { speed: sp, grounded: true, pose: 'idle' });
    }
  }

  teardown() {
    const c = this.cur, g = this.g;
    if (!c) return;
    g.engine.scene.remove(c.group);
    for (const m of c.group.children) m.geometry.dispose();
    for (const col of c.colliders) g.collision.remove(col);
    for (const v of c.vendors) { g.engine.scene.remove(v.av.root); g.labels.remove(v.lab); }
    for (const s of c.shoppers) g.engine.scene.remove(s.av.root);
    for (const i of c.inters) g.interactions.remove(i);
    this.cur = null;
  }
}

// Fenêtre d'un stand : articles du jour, offre flash, achat (carte ou espèces), négociation.
export function stallPanel(g, o, st) {
  const V = VENDORS[st.vendor];
  let say = V.hello, deals = {};
  const m = g.ui.modal({
    title: `${V.emoji} ${V.name}`, sub: `${CAL_BY_ID[o.id].name} · ferme dans ${minutesUntil(o.end, calNow(g))} min réelles${V.rare ? ' · objets rares' : ''}`,
    width: 'min(620px, 96vw)',
    build: (b, mm) => {
      b.append(h('div.vendor-say', `« ${say} »`));
      b.append(payRow(g, () => mm.refresh()));
      for (const it of st.items) {
        const def = g.net.content.items[it.id];
        const price = deals[it.id] ?? it.price;
        const bought = g.profile.market?.occ === o.occ ? g.profile.market.bought[`${st.id}|${it.id}`] || 0 : 0;
        b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, def.emoji || '📦'),
          h('div.grow', h('div.t', def.name, it.flash ? h('span.pill.warn', { style: { marginLeft: '6px' } }, 'Offre du jour') : null),
            h('div.d', `${fmt(price)} PC (neuf ${fmt(it.base)} PC)${deals[it.id] ? ' · prix négocié ✅' : ''} · ${it.qty - bought} dispo pour toi`)),
          h('div.col-btns',
            h('button.btn.small', { disabled: bought >= it.qty, onclick: async () => {
              try { const r = await g.net.request('market.buy', { occ: o.occ, stall: st.id, item: it.id, pay: getPay() }); g.sfx('cash'); g.ui.toast(`🛍️ ${def.name} acheté ${fmt(r.price)} PC${r.saved > 0 ? ` (−${fmt(r.saved)} PC par rapport au neuf)` : ''}`, 'good'); mm.refresh(); } catch (e) { g.ui.toast(e.message, 'bad'); }
            } }, 'Acheter'),
            deals[it.id] ? null : h('select.haggle', { onchange: async (e) => {
              const off = Number(e.target.value);
              if (!off) return;
              try {
                const r = await g.net.request('market.haggle', { occ: o.occ, stall: st.id, item: it.id, off });
                say = r.say;
                if (r.ok) { deals[it.id] = r.price; g.sfx('success'); } else { g.sfx('fail'); if (r.counter > 0) say += ` (Allez, −${Math.round(r.counter * 100)} % maximum.)`; }
              } catch (er) { g.ui.toast(er.message, 'bad'); }
              mm.refresh();
            } }, h('option', { value: 0 }, 'Négocier…'), OFFERS.map((x) => h('option', { value: x }, `Proposer −${Math.round(x * 100)} %`))))));
      }
    },
  });
  return m;
}
