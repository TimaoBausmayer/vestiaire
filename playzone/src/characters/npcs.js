import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { NPCS, CONVERSATIONS, BUMP_LINES, NIGHT_LINES } from './npc-data.js';
import { h } from '../ui/dom.js';
import { SECRETS, groundHeight } from '../../shared/world-layout.js';

// Habitants : déplacements, conversations entre eux, réactions aux bousculades, dialogues.
const pick = (a) => a[Math.floor(Math.random() * a.length)];

class NPC {
  constructor(mgr, def) {
    this.mgr = mgr;
    this.def = def;
    this.avatar = new Avatar(def.look);
    mgr.game.engine.scene.add(this.avatar.root);
    const start = def.at || def.points[0];
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

  update(dt, t, P, night) {
    const d = this.def;
    this.timer -= dt; this.bumpCd -= dt; this.talkCd -= dt;
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
    if (d.kind === 'wander' && this.state === 'idle' && this.talkCd < 0) {
      const other = this.mgr.list.find((n) => n !== this && n.def.kind === 'wander' && n.state === 'idle' && n.talkCd < 0 && n.pos.distanceTo(this.pos) < 6);
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
    this.nearest = null;
    game.interactions.add({
      r: 2.8, priority: 1,
      x: () => this.nearest?.pos.x ?? 1e9, z: () => this.nearest?.pos.z ?? 1e9,
      enabled: () => !!this.nearest,
      label: () => `Parler à ${this.nearest?.def.name}`,
      action: () => this.talk(this.nearest),
    });
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
      const d = Math.hypot(n.pos.x - P.x, n.pos.z - P.z);
      const vis = inWorld && d < ({ low: 55, medium: 80 }[g.engine.quality] || 110);
      n.avatar.root.visible = vis;
      if (!vis && d > 140) continue; // très loin : on fige
      n.update(dt, t, P, night);
      if (inWorld && d < bd) { bd = d; best = n; }
    }
    this.nearest = best;
  }
}
