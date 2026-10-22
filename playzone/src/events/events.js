import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { buildAnimal } from '../animals/models.js';
import { invasionChickens, invasionChickenPos, pumpkinSet } from '../../shared/minigame-logic.js';
import { POI, groundHeight } from '../../shared/world-layout.js';
import { buildMergedGeometry } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';

// ÉVÉNEMENTS PUBLICS (côté client) : affichage et participation. L'organisation, la validation et
// le podium sont gérés par l'autorité (shared/events-director.js), en solo comme en ligne.
export const PUMPKIN_GEO = buildMergedGeometry((sb) => {
  sb.sphere(0, 0.35, 0, 0.5, '#ff8c1a', 12, undefined, 0.75);
  sb.cyl(0, 0.68, 0, 0.06, 0.18, '#3f8f3a', 6);
  for (const x of [-0.16, 0.16]) sb.box(x, 0.42, 0.44, 0.12, 0.1, 0.05, '#ffe14d');
  sb.box(0, 0.25, 0.45, 0.34, 0.07, 0.05, '#ffe14d');
});

export class Events {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.objects = [];
    const net = game.net;
    net.on('event.start', (st) => this.start(st));
    net.on('event.update', (u) => this.onUpdate(u));
    net.on('event.end', (r) => this.end(r));
    const cur = net.currentEvent?.();
    if (cur) this.start(cur, true);
    game.interactions.add({ x: POI.eventBoard.x, z: POI.eventBoard.z, r: 3.2, priority: 2, label: '📋 Tableau des événements', action: () => this.openBoard() });
    // attraper / ramasser : interaction dynamique sur l'objet le plus proche
    game.interactions.add({
      r: 3.2, priority: 5,
      x: () => this.nearest()?.pos.x ?? 1e9, z: () => this.nearest()?.pos.z ?? 1e9,
      enabled: () => !!this.nearest(),
      label: () => (this.current?.id === 'invasion' ? (this.nearest()?.golden ? '🐔✨ Attraper le poulet DORÉ !' : '🐔 Attraper le poulet !') : '🎃 Ramasser la citrouille'),
      action: () => this.grab(this.nearest()),
    });
  }

  openBoard() {
    const g = this.game;
    const m = g.ui.modal({
      title: '📋 Tableau des événements', sub: 'Organise un événement pour toute la ville (et gagne de la réputation).', width: 'min(640px, 96vw)',
      build: (b) => {
        if (this.current) b.append(h('div.list-item', { style: { background: 'linear-gradient(90deg, rgba(255,90,95,.45), rgba(139,92,246,.45))', marginBottom: '12px' } }, h('span', { style: { fontSize: '26px' } }, this.current.emoji), h('div.grow', h('div.t', `En cours : ${this.current.name}`), h('div.d', `Organisé par ${this.current.by}`))));
        b.append(h('div.grid', Object.values(g.net.content.events).map((e) => h('div.card', e.seasonal ? h('span.badge.season', 'Saison') : null,
          h('div.emoji', e.emoji), h('div.title', e.name), h('div.desc', e.desc), h('div.desc', `Durée : ${Math.round(e.duration / 60 * 10) / 10} min`),
          h('div.price', `${e.triggerPrice} PC`),
          h('button.btn.small', {
            disabled: !!this.current || g.profile.coins < e.triggerPrice,
            onclick: async () => { try { await g.net.request('event.trigger', { eventId: e.id }); m.close(); } catch (err) { g.ui.toast(err.message, 'bad'); } },
          }, 'Organiser')))));
        b.append(h('p.muted', { style: { marginTop: '12px' } }, g.net.mode === 'solo' ? 'En solo, des habitants (PNJ) participent contre toi. En ligne, tous les joueurs de ton monde participent aussi. Les horaires sont dans l\'Agenda du téléphone.' : 'Tous les joueurs de ce monde participent. Les 3 meilleurs gagnent un bonus.'));
      },
    });
  }

  start(st, silent) {
    const g = this.game;
    this.clear();
    this.current = st;
    this.def = g.net.content.events[st.id];
    if (!silent) { g.sfx('whistle'); g.ui.toast(`${st.emoji} ${st.name} ! ${st.by ? `(organisé par ${st.by})` : ''}`, 'event', 5000); }
    g.phone?.badge('events');
    if (st.id === 'invasion') {
      const caught = new Set(st.caught || []);
      this.chickens = invasionChickens(st.seed, st.n).map((c) => {
        if (caught.has(c.i)) return null;
        const m = buildAnimal('poulet');
        if (c.golden) m.body.material = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.25, metalness: 0.8 });
        g.engine.scene.add(m.root);
        this.objects.push(m.root);
        return { ...c, model: m, pos: new THREE.Vector3(), golden: c.golden };
      });
    }
    if (st.id === 'chasse-citrouilles') {
      const taken = new Set(st.taken || []);
      this.pumpkins = pumpkinSet(st.seed, st.n).map((p) => {
        if (taken.has(p.i)) return null;
        const mesh = new THREE.Mesh(PUMPKIN_GEO, actorMaterial);
        mesh.position.set(p.x, groundHeight(p.x, p.z), p.z);
        mesh.scale.setScalar(1.5);
        g.engine.scene.add(mesh);
        this.objects.push(mesh);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 20, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ff8c1a', transparent: true, opacity: 0.25, depthWrite: false, fog: false }));
        beam.position.set(p.x, 10, p.z);
        g.engine.scene.add(beam);
        this.objects.push(beam);
        return { ...p, mesh, beam, pos: mesh.position };
      });
    }
    if (st.id === 'soiree-dj') this.buildDanceFloor();
  }

  buildDanceFloor() {
    const g = this.game, F = POI.danceFloor;
    this.tiles = [];
    const grp = new THREE.Group();
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.65).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#222', transparent: true, opacity: 0.85 }));
      m.position.set(F.x - F.w / 2 + 1 + i * 2, 0.07, F.z - F.d / 2 + 0.9 + j * 1.75);
      grp.add(m);
      this.tiles.push(m);
    }
    this.spots = [];
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ff3fa4', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      cone.position.set(POI.djStage.x - 6 + i * 4, 4.2, POI.djStage.z + 2);
      grp.add(cone);
      this.spots.push(cone);
    }
    g.engine.scene.add(grp);
    this.objects.push(grp);
  }

  onUpdate(u) {
    const g = this.game;
    if (!this.current || u.id !== this.current.id) return;
    if (u.caught !== undefined && this.chickens?.[u.caught]) {
      const c = this.chickens[u.caught];
      g.fx.burst(c.pos, c.golden ? '#ffd23f' : '#ffffff', 14);
      if (u.by !== g.profile.name) g.labels.bubble(c.model.root, `Attrapé par ${u.by} !`, 1500);
      g.engine.scene.remove(c.model.root);
      this.chickens[u.caught] = null;
    }
    if (u.taken !== undefined && this.pumpkins?.[u.taken]) {
      const p = this.pumpkins[u.taken];
      g.fx.burst(p.pos, '#ff8c1a', 16);
      g.engine.scene.remove(p.mesh); g.engine.scene.remove(p.beam);
      this.pumpkins[u.taken] = null;
    }
    if (u.top) this.current.top = u.top;
  }

  nearest() {
    if (!this.current || this.game.player.zone !== 'world') return null;
    const P = this.game.player.pos;
    const list = this.current.id === 'invasion' ? this.chickens : this.current.id === 'chasse-citrouilles' ? this.pumpkins : null;
    if (!list) return null;
    let best = null, bd = 3.2;
    for (const o of list) {
      if (!o || (o.landed === false)) continue;
      const d = Math.hypot(o.pos.x - P.x, o.pos.z - P.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  async grab(o) {
    if (!o || o.pending) return;
    const g = this.game;
    o.pending = true;
    try {
      const kind = this.current.id === 'invasion' ? 'catch' : 'pumpkin';
      const r = await g.net.request('event.action', kind === 'catch' ? { kind, chicken: o.i } : { kind, pumpkin: o.i });
      g.reward(r, r.golden ? '🐔✨ Poulet doré !' : kind === 'catch' ? '🐔 Poulet attrapé' : '🎃 Citrouille');
      g.player.setPose('celebrate', 0.8);
      this.onUpdate({ id: this.current.id, caught: r.caught, taken: r.taken, by: g.profile.name });
    } catch (e) { g.ui.toast(e.message, 'bad', 1500); } finally { o.pending = false; }
  }

  end(res) {
    const g = this.game;
    this.clear();
    this.current = null;
    g.hud.setEventBanner(null);
    g.sound.music(false);
    const me = res.podium.find((p) => p.id === g.profile.id);
    g.ui.toast(`🏁 ${res.name} terminé ! ${res.podium.length ? `Podium : ${res.podium.map((p) => `${p.place}. ${p.name}${p.npc ? ' (PNJ)' : ''} (${p.n})`).join(' · ')}` : 'Personne n\'a participé...'}`, 'event', 7000);
    if (me) { g.sfx('levelup'); g.fx.confetti(g.player.pos, 80); g.ui.toast(`🏆 Tu es ${me.place === 1 ? '1er' : `${me.place}e`} ! +${me.coins} PC, +${me.rep} réputation`, 'good', 6000); }
  }

  clear() {
    for (const o of this.objects) this.game.engine.scene.remove(o);
    this.objects = [];
    this.chickens = null; this.pumpkins = null; this.tiles = null; this.spots = null;
  }

  update(dt, t) {
    const g = this.game, st = this.current;
    if (!st) return;
    const now = g.now();
    const et = (now - st.startsAt) / 1000;
    const left = Math.max(0, Math.ceil((st.endsAt - now) / 1000));
    const top = (st.top || []).slice(0, 3).map((r, i) => `${i + 1}. ${r.name}${r.npc ? ' (PNJ)' : ''} (${r.n})`).join(' · ');
    g.hud.setEventBanner({ title: `${st.emoji} ${st.name} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, text: top || (st.id === 'soiree-dj' ? 'Va sur la piste et danse (touches 1, 2, 3) !' : 'Sois le premier à participer !') });
    if (this.chickens) {
      for (const c of this.chickens) {
        if (!c) continue;
        const p = invasionChickenPos(c, et);
        c.landed = p.landed;
        const prev = c.pos.clone();
        c.pos.set(p.x, p.y, p.z);
        const m = c.model;
        m.root.position.copy(c.pos);
        if (p.landed) {
          const dx = c.pos.x - prev.x, dz = c.pos.z - prev.z;
          if (Math.hypot(dx, dz) > 0.001) m.root.rotation.y = Math.atan2(dx, dz);
          m.root.position.y += Math.abs(Math.sin(t * 10 + c.i)) * 0.1;
          m.wings[0].rotation.z = -1.0 - Math.sin(t * 14 + c.i) * 0.3; m.wings[1].rotation.z = -m.wings[0].rotation.z;
        } else { m.wings[0].rotation.z = -Math.sin(t * 25) * 0.9; m.wings[1].rotation.z = Math.sin(t * 25) * 0.9; m.root.rotation.y += dt * 3; }
        if (c.golden) m.root.scale.setScalar(1.25);
      }
      if (Math.random() < dt * 3) g.sfx('cluck');
    }
    if (this.pumpkins) for (const p of this.pumpkins) if (p) { p.mesh.rotation.y = t; p.mesh.position.y = groundHeight(p.x, p.z) + Math.abs(Math.sin(t * 2 + p.i)) * 0.25; }
    if (this.tiles) {
      const beat = Math.floor(t * 2);
      this.tiles.forEach((m, i) => m.material.color.setHSL(((beat * 0.13 + i * 0.37) % 1), 0.85, (beat + i) % 3 ? 0.55 : 0.25));
      this.spots.forEach((s, i) => { s.rotation.z = Math.sin(t * 1.5 + i) * 0.5; s.rotation.x = Math.cos(t * 1.2 + i) * 0.3; s.material.color.setHSL((t * 0.2 + i * 0.25) % 1, 1, 0.6); });
      const near = g.player.zone === 'world' && Math.hypot(g.player.pos.x - POI.djStage.x, g.player.pos.z - POI.djStage.z) < 70;
      g.sound.music(near);
      // danser sur la piste rapporte de la réputation (validé par l'autorité)
      const F = POI.danceFloor, P = g.player.pos;
      const onFloor = Math.abs(P.x - F.x) < F.w / 2 && Math.abs(P.z - F.z) < F.d / 2;
      // (horloge réelle, comme l'autorité : un "pas de danse" récompensé toutes les `tick` secondes)
      const nowR = performance.now();
      if (onFloor && g.player.pose === 'dance') {
        this.danceSince ??= nowR;
        if (nowR - this.danceSince >= this.def.tick * 1000) {
          this.danceSince = nowR;
          g.net.request('event.action', { kind: 'dance' }).then((r) => g.reward(r, '💃 Danse')).catch((e) => g.ui.toast(e.message, '', 1500));
        }
      } else this.danceSince = null;
    }
  }

  mapMarkers() {
    const out = [];
    if (this.chickens) out.push({ x: 0, z: 0, color: '#ff5a5f', icon: '🐔', r: 7 });
    if (this.pumpkins) for (const p of this.pumpkins) if (p) out.push({ x: p.x, z: p.z, color: '#ff8c1a', icon: '🎃', r: 4 });
    if (this.tiles) out.push({ x: POI.danceFloor.x, z: POI.danceFloor.z, color: '#ff3fa4', icon: '🎧', r: 6 });
    return out;
  }
}
