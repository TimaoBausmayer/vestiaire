import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { NPCS, CONVERSATIONS, BUMP_LINES, NIGHT_LINES } from './npc-data.js';
import { h } from '../ui/dom.js';
import { chatMode, npcMemory } from './chat-ui.js';
import { loveChoices, loveLine } from './romance-ui.js';
import { npcAction, npcReply } from '../../shared/chat.js';
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
    // ordre écrit en cours (suivre, danser, s'asseoir...)
    if (this.cmd) {
      const r = this.runCommand(dt, t);
      if (r) {
        this.pos.y = (d.y ?? groundHeight(this.pos.x, this.pos.z)) + (r.y || 0);
        this.avatar.root.position.copy(this.pos);
        if (r.pose !== 'dance') this.avatar.root.rotation.y = this.yaw;
        this.avatar.update(dt, { speed: r.moving ? r.speed || d.speed : 0, grounded: true, pose: r.pose, dance: 1 });
        return;
      }
      // ordre terminé : on reprend sa vie (le piéton repart vers la rue la plus proche)
      this.state = d.kind === 'crowd' ? 'walk' : 'idle'; this.timer = 1; this.target = null;
      if (d.kind === 'crowd') this.mgr.nextLeg(this);
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

  // Ordre donné par écrit (voir npcAction) : le PNJ le fait vraiment.
  command(type, long = 0) {
    const g = this.mgr.game, P = g.player.pos;
    const away = Math.atan2(this.pos.x - P.x, this.pos.z - P.z);
    const dur = long || { follow: 120, come: 20, dance: 14, sit: 18, jump: 3.2, wave: 3, leave: 12, run: 9, hug: 6, angry: 4, happy: 3.5, refuse: 2.5, stop: 25 }[type];
    if (!dur) return;
    this.cmd = { type, t: 0, dur };
    this.state = 'cmd';
    if (type === 'leave' || type === 'run') { const d = type === 'run' ? 45 : 28; this.cmd.to = { x: this.pos.x + Math.sin(away) * d, z: this.pos.z + Math.cos(away) * d }; }
    if (type === 'angry') this.say(pick(['😠 Non mais ça va pas ?!', '😤 Malpoli·e !', '😡 Je vais appeler ta mère !']), 3000);
    if (type === 'happy') this.say(pick(['😊 Merci, c\'est gentil !', '🥰 Oh, tu me fais rougir !', '😄 Toi aussi, t\'es top !']), 3000);
    if (type === 'hug') this.say('🤗', 3000);
  }

  // Exécution de l'ordre en cours. Renvoie { pose, moving } ou null quand c'est fini.
  runCommand(dt, t) {
    const c = this.cmd, g = this.mgr.game, P = g.player.pos;
    c.t += dt;
    const dPlayer = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    const face = () => { const want = Math.atan2(P.x - this.pos.x, P.z - this.pos.z); this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 5); };
    if (c.t > c.dur || (c.type === 'follow' && dPlayer > 60) || g.player.zone !== 'world') { this.cmd = null; return null; }
    switch (c.type) {
      case 'follow': case 'come': case 'hug': {
        const near = c.type === 'hug' ? 0.9 : c.type === 'come' ? 1.8 : 2.4;
        if (dPlayer > near) {
          // derrière le joueur, en marchant (ou en courant s'il va vite)
          this.target = { x: P.x - Math.sin(g.player.yaw) * near * 0.8, z: P.z - Math.cos(g.player.yaw) * near * 0.8 };
          const sp = Math.max(this.def.speed || 1.4, Math.min(7, dPlayer > 8 ? 6.5 : g.player.speed || 2));
          this.moveTo(dt, sp);
          return { pose: 'idle', moving: true, speed: sp };
        }
        face();
        if (c.type === 'come' && c.t > 2) c.dur = Math.min(c.dur, c.t + 6);
        return { pose: c.type === 'hug' ? 'celebrate' : 'idle', moving: false };
      }
      case 'leave': case 'run': {
        this.target = c.to;
        const moving = this.moveTo(dt, c.type === 'run' ? 6 : (this.def.speed || 1.4) * 1.2);
        if (!moving) c.dur = Math.min(c.dur, c.t);
        return { pose: c.type === 'run' ? 'celebrate' : 'idle', moving, speed: c.type === 'run' ? 6 : 1.7 };
      }
      case 'dance': face(); return { pose: 'dance', moving: false };
      case 'sit': return { pose: 'sit', moving: false, y: -0.42 };
      case 'jump': { face(); return { pose: 'celebrate', moving: false, y: Math.abs(Math.sin(c.t * 3 * Math.PI / 1.05)) * 0.7 }; }
      case 'wave': case 'happy': face(); return { pose: c.type === 'happy' ? 'celebrate' : 'wave', moving: false };
      case 'angry': { face(); return { pose: Math.sin(c.t * 14) > 0 ? 'throw' : 'idle', moving: false }; }
      case 'refuse': face(); return { pose: 'idle', moving: false };
      case 'stop': face(); return { pose: 'idle', moving: false };
    }
    return null;
  }
}

export class NPCs {
  constructor(game) {
    this.game = game;
    this.list = NPCS.map((d) => new NPC(this, d));
    // foule de piétons dans toute la ville (nombre selon la qualité graphique)
    const n = { low: 14, medium: 26 }[game.engine.quality] ?? 36;
    this.crowd = [];
    for (let i = 0; i < n; i++) { const c = new NPC(this, crowdDef(i)); c.ci = i; this.crowd.push(c); this.list.push(c); this.place(c, true); }
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
  // Au carrefour, on tourne au coin en restant sur son trottoir ; rares sont ceux qui traversent
  // (2 piétons au plus en même temps sur toute la ville).
  nextLeg(n) {
    n.crossing = false;
    const node = ROAD_GRAPH.nodes[n.toNode];
    const p = this.sidewalk(n.edge, node.x, node.z, n.side);
    if (Math.hypot(p.x - n.pos.x, p.z - n.pos.z) > 1.2) { n.target = p; return; }
    const opts = node.edges.filter((id) => id !== n.edge.id && ROAD_GRAPH.edges[id].kind !== 'highway');
    const id = opts.length ? opts[Math.floor(Math.random() * opts.length)] : n.edge.id;
    const edge = ROAD_GRAPH.edges[id];
    // côté de la nouvelle rue le plus proche (même angle de trottoir) ; parfois l'autre (traversée)
    const corner = [1, -1].map((sd) => ({ sd, q: this.sidewalk(edge, node.x, node.z, sd) })).sort((a, b) => Math.hypot(a.q.x - n.pos.x, a.q.z - n.pos.z) - Math.hypot(b.q.x - n.pos.x, b.q.z - n.pos.z));
    const crossers = this.crowd.filter((c) => c.crossing).length;
    const cross = crossers < 2 && Math.random() < 0.12;
    const pickSide = cross ? corner[1] : corner[0];
    n.edge = edge; n.side = pickSide.sd;
    n.toNode = edge.a === node.id ? edge.b : edge.a;
    if (this.blocked(pickSide.q.x, pickSide.q.z)) { n.target = corner[0].q; n.side = corner[0].sd; return; }
    n.crossing = cross;
    n.target = pickSide.q;
  }

  // Part des piétons dehors selon l'heure du jeu : presque personne au milieu de la nuit, foule l'après-midi.
  crowdShare() {
    const h = this.game.world?.dayNight?.hour ?? 15;
    if (h < 5) return 0.12; if (h < 7) return 0.3; if (h < 9) return 0.75; if (h < 12) return 0.85;
    if (h < 19) return 1; if (h < 22) return 0.65; return 0.3;
  }

  converse(a, b) {
    const conv = pick(CONVERSATIONS);
    for (const n of [a, b]) { n.state = 'chat'; n.timer = 7; n.target = null; }
    a.yaw = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    b.yaw = Math.atan2(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
    a.say(conv[0], 3200);
    setTimeout(() => b.say(conv[1] || '...', 3200), 3000);
  }

  // Ce que le joueur dit à voix haute (barre « Parler » ou chat) : le PNJ le plus proche (ou celui
  // dont on cite le prénom) répond et réagit.
  hear(text) {
    const g = this.game, P = g.player.pos, t = text.toLowerCase();
    if (g.player.zone !== 'world') return null;
    const near = this.list.filter((n) => n.avatar.root.visible && !n.home && Math.hypot(n.pos.x - P.x, n.pos.z - P.z) < 14);
    let n = near.find((x) => t.includes(x.def.name.toLowerCase().split(' ')[0]));
    // « tout le monde », « vous » : tous ceux qui sont autour
    const all = /tout le monde|vous tous|tous ensemble|everybody/.test(t);
    if (!n) n = near.sort((a, b) => Math.hypot(a.pos.x - P.x, a.pos.z - P.z) - Math.hypot(b.pos.x - P.x, b.pos.z - P.z))[0];
    if (!n || Math.hypot(n.pos.x - P.x, n.pos.z - P.z) > 9 && !all) return null;
    for (const x of all ? near.slice(0, 8) : [n]) this.respond(x, text, x === n);
    return n;
  }

  respond(n, text, speak = true) {
    const g = this.game;
    const mem = npcMemory(n.def.id || n.def.name);
    const act = npcAction(text, mem.mood || 0);
    const r = npcReply(text, { name: n.def.name, role: n.def.role }, { hour: g.world?.dayNight?.hour ?? 12, kts: 10, pos: { x: n.pos.x, z: n.pos.z }, player: g.profile?.name }, mem);
    if (act) n.command(act.type);
    if (speak) {
      const line = act?.reply || r;
      if (!['angry', 'happy', 'hug'].includes(act?.type)) n.say(line.length > 90 ? `${line.slice(0, 88)}…` : line, 4500);
    }
    return { act, reply: act?.reply || r };
  }

  // Dialogue avec un habitant : discussion, conseil, indices.
  talk(n) {
    if (!n) return;
    const g = this.game;
    n.state = 'react'; n.timer = 999;
    n.yaw = Math.atan2(g.player.pos.x - n.pos.x, g.player.pos.z - n.pos.z);
    g.player.yaw = Math.atan2(n.pos.x - g.player.pos.x, n.pos.z - g.player.pos.z);
    const d = n.def;
    let choices;
    const build = () => (choices = [
      { label: '💬 Discuter', action: (m) => m.show(pick(n.lines()), build()) },
      { label: '💡 Un conseil ?', action: (m) => m.show(this.hint(n), build()) },
      { label: '⌨️ Écrire', action: (m) => chatMode(g, m, { id: d.id || d.name, name: d.name, role: d.role, root: n.avatar.root, npc: n }, (x) => x.show(pick(n.lines()), build())) },
      ...loveChoices(g, n, build),
      { label: 'Au revoir', ghost: true, action: (m) => { m.close(); n.state = 'idle'; n.timer = 1; } },
    ]);
    build();
    const line = loveLine(g, n);
    const dlg = g.ui.dialog({ name: d.name, role: line ? `${d.role} · ${line}` : d.role, text: pick(n.lines()), choices });
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
    const active = Math.round(this.crowd.length * this.crowdShare());
    for (const n of this.list) {
      // piétons « rentrés chez eux » selon l'heure : invisibles et figés ; ils ressortent loin du joueur
      if (n.def.kind === 'crowd') {
        if (n.ci >= active && !n.cmd) { if (!n.home) { n.home = true; n.avatar.root.visible = false; n.crossing = false; } continue; }
        if (n.home) { n.home = false; this.place(n); }
      }
      let d = Math.hypot(n.pos.x - P.x, n.pos.z - P.z);
      // piétons trop loin : ils réapparaissent plus près (hors de vue)
      if (n.def.kind === 'crowd' && inWorld && d > 150 && n.state !== 'ko' && !n.cmd) { this.place(n); d = Math.hypot(n.pos.x - P.x, n.pos.z - P.z); }
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
