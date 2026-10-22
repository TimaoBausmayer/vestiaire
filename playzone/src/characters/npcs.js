import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { NPCS, CONVERSATIONS, BUMP_LINES, NIGHT_LINES } from './npc-data.js';
import { h } from '../ui/dom.js';
import { SECRETS, groundHeight, ROAD_GRAPH, BUILDINGS } from '../../shared/world-layout.js';
import { CHARACTERS, PASSERS } from './crowd-data.js';
import { DEFAULT_APPEARANCE, SKINS, HAIR_STYLES, HAIR_COLORS, COLORS } from '../../shared/appearance.js';

// Habitants : déplacements, conversations entre eux, réactions aux bousculades, dialogues.
const pick = (a) => a[Math.floor(Math.random() * a.length)];

class NPC {
  constructor(mgr, def) {
    this.mgr = mgr;
    this.def = def;
    this.avatar = new Avatar(def.look, def.extra || {});
    mgr.game.engine.scene.add(this.avatar.root);
    const start = def.at || def.points?.[0] || [0, 0];
    this.pos = new THREE.Vector3(start[0], def.y ?? 0, start[1]);
    this.yaw = def.face ?? 0;
    this.state = 'idle';
    this.timer = Math.random() * 4;
    this.target = null;
    this.speed = 0;
    this.bumpCd = 0;
    this.talkCd = 5 + Math.random() * 10;
    this.label = mgr.game.labels.add(this.avatar.root, h('div.wlabel', def.name, h('div.tag', def.role)), 2.45, 14);
  }

  // Renversé (coup de poing, voiture) : au sol quelques secondes, puis se relève furieux.
  knock(fromX, fromZ) {
    this.state = 'ko'; this.timer = 3.5;
    this.yaw = Math.atan2(fromX - this.pos.x, fromZ - this.pos.z);
    this.say(pick(['Aïe !!!', 'Mais ça va pas ?!', 'Au secours, police !', 'Mon dentier !', 'Je vais le dire à ma mère !']), 2500);
  }

  update(dt, t, P, night) {
    const d = this.def;
    this.timer -= dt; this.bumpCd -= dt; this.talkCd -= dt;
    if (this.state === 'ko') {
      const r = this.avatar.root;
      r.rotation.order = 'YXZ';
      r.position.copy(this.pos);
      r.rotation.set(this.timer > 0.4 ? -Math.PI / 2 : 0, this.yaw, 0);
      r.position.y = (this.def.y ?? groundHeight(this.pos.x, this.pos.z)) + (this.timer > 0.4 ? 0.25 : 0);
      this.avatar.update(dt, { speed: 0, grounded: true, pose: 'idle' });
      if (this.timer <= 0) { r.rotation.set(0, this.yaw, 0); this.state = 'react'; this.timer = 2; this.say(pick(['J\'appelle la police !', 'Vous allez avoir de mes nouvelles !', 'Espèce de malotru !']), 2500); }
      return;
    }
    const dPlayer = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    let pose = 'idle', moving = false;
    // bousculade
    const g = this.mgr.game;
    if (dPlayer < 0.95 && g.player.speed > 3.5 && this.bumpCd < 0 && g.player.zone === 'world') {
      this.bumpCd = 4;
      this.say(pick(BUMP_LINES));
      this.state = 'react'; this.timer = 1.6;
      this.yaw = Math.atan2(P.x - this.pos.x, P.z - this.pos.z);
    }
    if (this.state === 'react') {
      pose = 'wave';
      if (this.timer < 0) { this.state = 'idle'; this.timer = 1; }
    } else if (this.state === 'chat') {
      pose = Math.sin(t * 3 + this.pos.x) > 0.6 ? 'wave' : 'idle';
      if (this.timer < 0) { this.state = 'idle'; this.timer = 2 + Math.random() * 3; this.talkCd = 20 + Math.random() * 20; }
    } else if (d.kind === 'stand') {
      // reste à son poste ; se tourne vers le joueur proche, parle de temps en temps
      const want = dPlayer < 5 ? Math.atan2(P.x - this.pos.x, P.z - this.pos.z) : d.face ?? 0;
      this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 3);
      if (dPlayer < 7 && this.talkCd < 0) { this.talkCd = 18 + Math.random() * 14; this.say(night > 0.6 && Math.random() < 0.3 ? pick(NIGHT_LINES) : pick(this.lines())); }
      if (d.id === 'dj' && this.mgr.game.events?.current?.id === 'soiree-dj') { pose = 'dance'; this.avatar.root.rotation.y = this.yaw; }
    } else if (d.kind === 'crowd') {
      // piéton : suit le trottoir d'une rue à l'autre, s'arrête parfois (téléphone, vitrine)
      if (this.state === 'pause') { pose = this.phone ? 'phone' : 'idle'; if (this.timer < 0) { this.state = 'walk'; this.phone = false; } }
      else {
        if (!this.target) this.mgr.nextLeg(this);
        moving = this.moveTo(dt, d.speed);
        if (!moving) {
          if (Math.random() < 0.18) { this.state = 'pause'; this.timer = 2 + Math.random() * 5; this.phone = Math.random() < 0.5; }
          this.mgr.nextLeg(this);
        }
      }
    } else if (this.state === 'walk') {
      moving = this.moveTo(dt, d.speed);
      if (!moving) { this.state = 'idle'; this.timer = d.kind === 'runner' ? 0.5 : 3 + Math.random() * 6; }
    } else if (this.timer < 0) {
      const p = pick(d.points);
      this.target = { x: p[0] + (Math.random() - 0.5) * 4, z: p[1] + (Math.random() - 0.5) * 4 };
      this.state = 'walk';
      this.stuck = 0;
    }
    // conversations spontanées entre promeneurs
    if ((d.kind === 'wander' || d.kind === 'crowd') && (this.state === 'idle' || this.state === 'pause') && this.talkCd < 0) {
      const other = this.mgr.list.find((n) => n !== this && (n.def.kind === 'wander' || n.def.kind === 'crowd') && n.state === 'idle' && n.talkCd < 0 && n.pos.distanceTo(this.pos) < 6);
      if (other) this.mgr.converse(this, other);
      else this.talkCd = 5;
    }
    this.pos.y = d.y ?? groundHeight(this.pos.x, this.pos.z);
    this.avatar.root.position.copy(this.pos);
    if (pose !== 'dance') this.avatar.root.rotation.y = this.yaw;
    this.avatar.update(dt, { speed: moving ? d.speed : 0, grounded: true, pose, dance: 1 });
  }

  moveTo(dt, speed) {
    const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) return false;
    const want = Math.atan2(dx, dz);
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 6);
    const step = Math.min(dist, speed * dt);
    const bx = this.pos.x, bz = this.pos.z;
    this.pos.x += Math.sin(this.yaw) * step;
    this.pos.z += Math.cos(this.yaw) * step;
    this.mgr.game.collision.pushOut(this.pos, 0.4, 1.8, 0.6);
    const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
    this.stuck = moved < step * 0.3 ? this.stuck + dt : 0;
    if (this.stuck > 1.2) { this.stuck = 0; this.target = { x: this.pos.x + (Math.random() - 0.5) * 8, z: this.pos.z + (Math.random() - 0.5) * 8 }; }
    return true;
  }

  lines() {
    const seasonal = this.mgr.game.net?.content?.npcLines || [];
    return seasonal.length && Math.random() < 0.25 ? [...this.def.lines, ...seasonal] : this.def.lines;
  }

  say(text, ms = 4200) { this.mgr.game.labels.bubble(this.avatar.root, text, ms, '', 2.75); }
}

export class NPCs {
  constructor(game) {
    this.game = game;
    this.list = NPCS.map((d) => new NPC(this, d));
    // foule de piétons dans toute la ville (nombre selon la qualité graphique)
    const n = { low: 14, medium: 26 }[game.engine.quality] ?? 36;
    this.crowd = [];
    for (let i = 0; i < n; i++) { const c = new NPC(this, crowdDef(i)); this.crowd.push(c); this.list.push(c); this.place(c, true); }
    this.nearest = null;
    game.interactions.add({
      r: 2.8, priority: 1,
      x: () => this.nearest?.pos.x ?? 1e9, z: () => this.nearest?.pos.z ?? 1e9,
      enabled: () => !!this.nearest,
      label: () => `Parler à ${this.nearest?.def.name}`,
      action: () => this.talk(this.nearest),
    });
  }

  // Place un piéton sur un trottoir à bonne distance du joueur (ou n'importe où au départ).
  place(n, initial = false) {
    const P = this.game.player?.pos || { x: 0, z: 12 };
    const N = ROAD_GRAPH.nodes;
    const E = ROAD_GRAPH.edges.filter((e) => e.kind !== 'highway' && Math.max(Math.min(N[e.a].x, N[e.b].x) - P.x, P.x - Math.max(N[e.a].x, N[e.b].x), Math.min(N[e.a].z, N[e.b].z) - P.z, P.z - Math.max(N[e.a].z, N[e.b].z)) < 125);
    if (!E.length) return false;
    for (let k = 0; k < 60; k++) {
      const e = E[Math.floor(Math.random() * E.length)];
      const a = ROAD_GRAPH.nodes[e.a], b = ROAD_GRAPH.nodes[e.b];
      const t = Math.random(), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const d = Math.hypot(x - P.x, z - P.z);
      if (initial ? d > 130 : d < 45 || d > 120) continue;
      n.edge = e; n.toNode = Math.random() < 0.5 ? e.a : e.b; n.side = Math.random() < 0.5 ? 1 : -1;
      const p = this.sidewalk(e, x, z, n.side);
      if (this.blocked(p.x, p.z)) continue;
      n.pos.set(p.x, groundHeight(p.x, p.z), p.z);
      n.target = null; n.state = 'walk';
      return true;
    }
    return false;
  }

  sidewalk(e, x, z, side) {
    const a = ROAD_GRAPH.nodes[e.a], b = ROAD_GRAPH.nodes[e.b];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    const off = (e.w || 8) / 2 + 1.4;
    return { x: x + (-dz / l) * off * side, z: z + (dx / l) * off * side };
  }

  blocked(x, z) { return BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.6 && Math.abs(z - b.z) < b.d / 2 + 0.6); }

  // Prochain tronçon : on va au bout de la rue, puis on tourne au hasard au carrefour.
  nextLeg(n) {
    const node = ROAD_GRAPH.nodes[n.toNode];
    const p = this.sidewalk(n.edge, node.x, node.z, n.side);
    if (Math.hypot(p.x - n.pos.x, p.z - n.pos.z) > 1.2) { n.target = p; return; }
    const opts = node.edges.filter((id) => id !== n.edge.id && ROAD_GRAPH.edges[id].kind !== 'highway');
    const id = opts.length ? opts[Math.floor(Math.random() * opts.length)] : n.edge.id;
    n.edge = ROAD_GRAPH.edges[id];
    n.toNode = n.edge.a === node.id ? n.edge.b : n.edge.a;
    const q = this.sidewalk(n.edge, ROAD_GRAPH.nodes[n.toNode].x, ROAD_GRAPH.nodes[n.toNode].z, n.side);
    n.target = this.blocked(q.x, q.z) ? { x: ROAD_GRAPH.nodes[n.toNode].x, z: ROAD_GRAPH.nodes[n.toNode].z } : q;
  }

  converse(a, b) {
    const conv = pick(CONVERSATIONS);
    for (const n of [a, b]) { n.state = 'chat'; n.timer = 7; n.target = null; }
    a.yaw = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    b.yaw = Math.atan2(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
    a.say(conv[0], 3200);
    setTimeout(() => b.say(conv[1] || '...', 3200), 3000);
  }

  // Dialogue avec un habitant : discussion, conseil, indices.
  talk(n) {
    if (!n) return;
    const g = this.game;
    n.state = 'react'; n.timer = 999;
    n.yaw = Math.atan2(g.player.pos.x - n.pos.x, g.player.pos.z - n.pos.z);
    g.player.yaw = Math.atan2(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z);
    const d = n.def;
    const choices = [
      { label: '💬 Discuter', action: (m) => m.show(pick(n.lines()), choices) },
      { label: '💡 Un conseil ?', action: (m) => m.show(this.hint(n), choices) },
      { label: 'Au revoir', ghost: true, action: (m) => { m.close(); n.state = 'idle'; n.timer = 1; } },
    ];
    const dlg = g.ui.dialog({ name: d.name, role: d.role, text: pick(n.lines()), choices });
    const off = setInterval(() => { if (dlg.closed) { clearInterval(off); n.state = 'idle'; n.timer = 1; } }, 300);
  }

  hint(n) {
    const g = this.game;
    const p = g.profile;
    if (n.def.hints === 'secrets') {
      const left = SECRETS.filter((s) => !p.secrets.includes(s.id));
      if (!left.length) return 'Tu as trouvé tous les canards dorés ! Même moi, je n\'y croyais pas.';
      const s = pick(left);
      return `Canards dorés trouvés : ${p.secrets.length}/${SECRETS.length}. Un indice ? « ${s.hint} »`;
    }
    if (n.def.hints === 'events') return 'Au tableau des événements, tu peux lancer une Invasion de poulets ou une Soirée DJ pour toute la ville. Ça coûte un peu, mais ça rapporte de la réputation !';
    if (n.def.hints === 'course') return 'Le parcours démarre au panneau près de moi. Six anneaux, dans l\'ordre. La boue te renvoie au dernier anneau franchi.';
    return pick([
      'Les métiers paient mieux quand tu montes de niveau. Et les améliorations s\'achètent à chaque poste de travail.',
      'Le téléphone (touche P) contient la carte, tes missions, tes animaux et ton garage.',
      'Il y a un trampoline derrière la salle d\'arcade. Personne ne sait pourquoi.',
      'Chaque jour, un bonus de PlayCoins t\'attend. Plus tu reviens souvent, plus il grossit.',
      'Les stands du parc de loisirs rapportent des PlayCoins. Et de la gloire. Surtout des PlayCoins.',
    ]);
  }

  update(dt, t) {
    const g = this.game;
    const P = g.player.pos;
    const inWorld = g.player.zone === 'world';
    const night = g.world.dayNight.night;
    let best = null, bd = 2.8;
    for (const n of this.list) {
      let d = Math.hypot(n.pos.x - P.x, n.pos.z - P.z);
      // piétons trop loin : ils réapparaissent plus près (hors de vue)
      if (n.def.kind === 'crowd' && inWorld && d > 150 && n.state !== 'ko') { this.place(n); d = Math.hypot(n.pos.x - P.x, n.pos.z - P.z); }
      const vis = inWorld && d < ({ low: 55, medium: 75 }[g.engine.quality] || 95);
      n.avatar.root.visible = vis;
      if (!vis && d > 140) continue; // très loin : on fige
      n.update(dt, t, P, night);
      if (inWorld && d < bd) { bd = d; best = n; }
    }
    this.nearest = best;
  }
}

// Fiche d'un piéton : un personnage drôle de l'affiche (un sur trois) ou un passant ordinaire.
function crowdDef(i) {
  const r = Math.random;
  const pk = (a) => a[Math.floor(r() * a.length)];
  const base = { ...DEFAULT_APPEARANCE, skin: pk(SKINS.slice(0, 8)), hair: pk(HAIR_STYLES), hairColor: pk(HAIR_COLORS.slice(0, 7)), topColor: pk(COLORS), bottomColor: pk(['#2b2d42', '#3d8ee8', '#7a5230', '#14213d', '#9aa5b1']), body: pk(['mince', 'moyen', 'moyen', 'costaud']), height: 0.92 + r() * 0.16, bottom: r() < 0.75 ? 'jean' : 'short' };
  if (i % 3 === 0) {
    const c = CHARACTERS[(i / 3) % CHARACTERS.length];
    const { top, topColor, body, ...rest } = c.look;
    return { id: `crowd-${i}`, kind: 'crowd', name: c.name, role: c.role, speed: 1.3 + r() * 0.5, lines: c.lines, look: { ...base, ...rest, ...(body ? { body } : {}) }, extra: { top, topColor } };
  }
  return { id: `crowd-${i}`, kind: 'crowd', name: pk(PASSERS.first), role: pk(PASSERS.roles), speed: 1.2 + r() * 0.6, lines: [pk(PASSERS.lines), pk(PASSERS.lines), pk(PASSERS.lines)], look: base, extra: { top: pk(['tshirt', 'sweat', 'chemise', 'raye', 'costume']), topColor: base.topColor } };
}
