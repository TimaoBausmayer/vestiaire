import { h } from '../ui/dom.js';
import { WorldVehicle, vehicleName } from '../vehicles/vehicles.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';
import { CRIMES } from '../../shared/justice.js';

// DÉLITS (côté client) : coup de poing (G), vol à la tire, vol de voiture (garée, ou en sortant le
// conducteur), revente à la casse, braquage de la banque, piéton renversé. Le client constate, la
// police (et l'autorité) décident. Les policiers joueurs peuvent arrêter les joueurs recherchés.

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Crimes {
  constructor(game) {
    this.game = game;
    const g = game;
    // coup de poing
    g.input.on('key', (e) => { if (e.code === 'KeyG' && !g.ui.blocking && !g.vehicles?.driving && g.player.zone === 'world') this.punch(); });
    // vol à la tire (dans le dos d'un passant)
    g.interactions.add({
      r: 1.6, priority: 2,
      x: () => this.pickTarget()?.pos.x ?? 1e9, z: () => this.pickTarget()?.pos.z ?? 1e9,
      enabled: () => !!this.pickTarget(),
      label: () => `🤏 Faire les poches de ${this.pickTarget()?.def.name} (illégal)`,
      action: () => this.pickpocket(this.pickTarget()),
    });
    // vol de voiture garée
    g.interactions.add({
      r: 2.6, priority: 2,
      x: () => this.parkedTarget()?.x ?? 1e9, z: () => this.parkedTarget()?.z ?? 1e9,
      enabled: () => !!this.parkedTarget() && !g.vehicles.driving && g.player.zone === 'world',
      label: () => (this.parkedTarget()?.locked ? '🔨 Forcer la portière (illégal, bruyant)' : '🔓 Voler cette voiture (illégal)'),
      action: () => this.stealParked(this.parkedTarget()),
    });
    // voler une voiture de la circulation (arrêtée)
    g.interactions.add({
      r: 2.4, priority: 3,
      x: () => this.trafficTarget()?.pos.x ?? 1e9, z: () => this.trafficTarget()?.pos.z ?? 1e9,
      enabled: () => !!this.trafficTarget() && !g.vehicles.driving && g.player.zone === 'world',
      label: '🚗 Sortir le conducteur et voler la voiture (illégal)',
      action: () => this.carjack(this.trafficTarget()),
    });
    // casse : revendre la voiture volée
    g.interactions.add({
      zone: 'any', r: 1e9, priority: 7,
      x: () => g.player.pos.x, z: () => g.player.pos.z,
      enabled: () => this.atCasse() && !!this.stolenNearby(),
      label: '💰 Revendre la voiture volée à la casse (en liquide)',
      action: () => this.fence(),
    });
    // policier joueur : arrêter un joueur recherché
    g.interactions.add({
      r: 2.6, priority: 8,
      x: () => this.wantedRemote()?.pos.x ?? 1e9, z: () => this.wantedRemote()?.pos.z ?? 1e9,
      enabled: () => !!this.wantedRemote(),
      label: () => `🚔 Arrêter ${this.wantedRemote()?.name} (${'★'.repeat(this.wantedRemote()?.info.stars || 0)})`,
      action: () => this.arrestRemote(this.wantedRemote()),
    });
    this.hitCd = 0;
  }

  // ------------------------------------------------------------------ cibles
  pickTarget() {
    const g = this.game, P = g.player.pos;
    if (g.vehicles?.driving || g.player.zone !== 'world' || !g.npcs) return null;
    for (const n of g.npcs.list) {
      if (n.def.kind === 'stand' || n.state === 'ko') continue;
      const dx = P.x - n.pos.x, dz = P.z - n.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.5) continue;
      // derrière lui : le passant ne nous regarde pas
      const facing = Math.sin(n.yaw) * dx + Math.cos(n.yaw) * dz;
      if (facing < 0) return n;
    }
    return null;
  }
  parkedTarget() { const g = this.game; return g.parked?.nearest(g.player.pos, 2.6) || null; }
  trafficTarget() {
    const g = this.game, P = g.player.pos;
    for (const c of g.traffic?.cars || []) if (c.speed < 0.6 && !['police', 'ambulance', 'pompiers', 'bus'].includes(c.model) && Math.hypot(c.pos.x - P.x, c.pos.z - P.z) < 2.6) return c;
    return null;
  }
  witnesses(P, r = 25) {
    const g = this.game;
    let n = 0;
    for (const x of g.npcs?.list || []) if (x.state !== 'ko' && Math.hypot(x.pos.x - P.x, x.pos.z - P.z) < r) n++;
    if (g.police?.nearbyCop(P, 50)) n += 3;
    return n;
  }
  atCasse() {
    const b = BUILDING_BY_ID.casse, P = this.game.player.pos, y = b?.yard;
    return !!y && P.x > y.x1 - 3 && P.x < y.x2 + 3 && P.z > y.z1 - 3 && P.z < y.z2 + 3;
  }
  stolenNearby() {
    const g = this.game;
    return g.vehicles.list.find((v) => v.owner === 'stolen' && v.pos.distanceTo(g.player.pos) < 8) || null;
  }
  wantedRemote() {
    const g = this.game;
    if (g.career?.shift?.job !== 'policier' || !g.remotes) return null;
    for (const r of g.remotes.all()) if ((r.info?.stars || 0) > 0 && r.zone === 'world' && r.pos.distanceTo(g.player.pos) < 2.6) return r;
    return null;
  }

  // ------------------------------------------------------------------ actions
  punch() {
    const g = this.game, P = g.player.pos;
    if (this.hitCd > 0) return;
    this.hitCd = 0.8;
    g.player.setPose('throw', 0.5);
    // voleur PNJ : on aide la police
    if (g.emergencies?.punchTarget(P)) return;
    // frapper un policier : il tombe (et ça coûte cher)
    for (const u of g.police.units) {
      const o = u.officer;
      if (o && !(o.stun > 0) && Math.hypot(o.pos.x - P.x, o.pos.z - P.z) < 2) {
        o.stun = 3; g.sfx('bump');
        g.labels.bubble(o.av.root, 'Outrage et rébellion ! Renforts !', 2500);
        g.police.crime('agression-policier', true);
        return;
      }
    }
    let target = null, bd = 1.9;
    for (const n of g.npcs?.list || []) { const d = Math.hypot(n.pos.x - P.x, n.pos.z - P.z); if (d < bd && n.state !== 'ko') { bd = d; target = n; } }
    if (!target) { g.sfx('throw'); return; }
    g.sfx('bump');
    target.knock(P.x, P.z);
    const w = this.witnesses(P) > 1 || Math.random() < 0.5;
    g.police.crime('coups', w);
  }

  async pickpocket(n) {
    const g = this.game;
    if (!n) return;
    g.player.setPose('pet', 1);
    try {
      const r = await g.net.request('crime.pickpocket', {});
      if (r.success) { g.sfx('coin'); g.ui.toast(`🤏 Discrètement... +${r.loot} PC en liquide (vol).`, 'money', 3000); }
      else { n.say(pick(['Hé ! Au voleur !', 'Ma main n\'est pas votre poche !', 'Police !!!']), 2500); n.yaw = Math.atan2(g.player.pos.x - n.pos.x, g.player.pos.z - n.pos.z); }
      if (r.caught) { g.police.seenAt = g.now(); g.sfx('whistle'); g.ui.toast(`🚨 ${CRIMES['vol-tire'].name} : repéré·e ! (${'★'.repeat(r.stars)})`, 'bad', 4000); g.police.renderStars(); }
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  stealParked(car) {
    const g = this.game;
    if (!car) return;
    const go = () => {
      g.parked.take(car);
      const v = new WorldVehicle(g, { model: car.model, color: car.paint, x: car.x, z: car.z, yaw: car.yaw, owner: 'stolen' });
      g.vehicles.list.push(v);
      g.vehicles.enter(v);
      const w = car.locked || this.witnesses(g.player.pos, 20) > 0;
      g.police.crime('vol-voiture', w, { model: car.model });
      if (!w) g.ui.toast(`🤫 ${vehicleName(car.model)} volé·e sans témoin. Revends-la à la casse (zone des Boulons) !`, '', 4500);
    };
    if (!car.locked) { go(); return; }
    // portière verrouillée : il faut forcer (3 s, l'alarme hurle)
    g.player.setPose('hold-forward', 3);
    g.sfx('drill');
    const bar = h('div.cook-game', h('div.t', '🔨 Forçage de la serrure...'), h('div.cook-bar', h('div.cook-perfect', { style: { left: '0', width: '0%', transition: 'width 3s linear' } })));
    g.ui.root.append(bar);
    requestAnimationFrame(() => { bar.querySelector('.cook-perfect').style.width = '100%'; });
    setTimeout(() => { bar.remove(); if (g.parked.nearest(g.player.pos, 3) === car) { g.sfx('horn-truck'); go(); } }, 3000);
  }

  carjack(c) {
    const g = this.game;
    if (!c) return;
    const i = g.traffic.cars.indexOf(c);
    g.labels.bubble(c.root, pick(['Hé ! Ma voiture !', 'AU VOLEUR !', 'J\'avais pas fini mon sandwich !']), 2600, '', 2.4);
    const v = new WorldVehicle(g, { model: c.model, color: `#${c.visual.u.uPaint.value.getHexString()}`, x: c.pos.x, z: c.pos.z, yaw: c.yaw, owner: 'stolen' });
    g.vehicles.list.push(v);
    // la voiture de la circulation est remplacée plus loin
    if (i >= 0) g.traffic.spawn(i);
    g.vehicles.enter(v);
    g.police.crime('vol-voiture', true, { model: c.model });
  }

  async fence() {
    const g = this.game, v = this.stolenNearby();
    if (!v) return;
    try {
      if (g.vehicles.current === v) g.vehicles.exit(true);
      const r = await g.net.request('crime.fence', {});
      g.vehicles.despawn(v, false);
      g.sfx('cash');
      g.ui.toast(`💰 Le ferrailleur te file ${r.gain} PC en liquide, sans poser de question.${r.stars ? ' Mais quelqu\'un a vu...' : ''}`, 'money', 4500);
      g.police.renderStars();
    } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  // Braquage : 20 s au coffre pendant que l'alarme sonne.
  robBank() {
    const g = this.game;
    g.ui.dialog({ name: '🔒 Coffre-fort', role: 'Banque PlayCoins', text: `Braquer la banque ? C'est TRÈS illégal : 4 étoiles de recherche et ${CRIMES.braquage.jail} minutes de prison si tu te fais prendre. Il faut tenir 20 secondes au coffre.`, choices: [
      { label: '💰 Braquer (très illégal)', action: async (m) => {
        m.close();
        try {
          await g.net.request('crime.robStart', {});
          g.police.seenAt = g.now(); g.police.renderStars();
          g.sfx('whistle');
          g.ui.toast('🚨 ALARME ! La police arrive. Reste au coffre 20 secondes...', 'bad', 5000);
          let t = 20;
          g.player.setPose('hold-forward', 21);
          const iv = setInterval(async () => {
            t--;
            g.hud.track('robbery', { title: '💰 Braquage en cours', text: `Perçage du coffre : ${t} s`, bar: 1 - t / 20 });
            if (t > 0) { if (t % 3 === 0) g.sfx('drill'); return; }
            clearInterval(iv);
            g.hud.track('robbery', null);
            try { const r = await g.net.request('crime.robLoot', {}); g.sfx('cash'); g.ui.toast(`💰 ${r.loot} PC en liquide dans le sac ! Maintenant, FUIS !`, 'money', 5000); } catch (e) { g.ui.toast(e.message, 'bad'); }
          }, 1000);
        } catch (e) { g.ui.toast(e.message, 'bad'); }
      } },
      { label: 'Non, je suis honnête', ghost: true, action: (m) => m.close() },
    ] });
  }

  async arrestRemote(r) {
    const g = this.game;
    if (!r) return;
    try { const x = await g.net.request('police.arrestPlayer', { targetId: r.id }); g.sfx('success'); g.ui.toast(`🚔 ${x.name} arrêté·e (${x.minutes} min de prison) : prime de ${x.reward} PC !`, 'money', 4500); } catch (e) { g.ui.toast(e.message, 'bad'); }
  }

  update(dt) {
    const g = this.game;
    this.hitCd -= dt;
    // voitures volées abandonnées loin : elles disparaissent
    this.cleanT = (this.cleanT || 0) - dt;
    if (this.cleanT <= 0) {
      this.cleanT = 2;
      for (const v of [...g.vehicles.list]) if (v.owner === 'stolen' && v !== g.vehicles.current && v.pos.distanceTo(g.player.pos) > 300) g.vehicles.despawn(v, false);
    }
    // piéton renversé par le joueur au volant
    const v = g.vehicles?.current;
    if (v && v.sim.speed > 6 && g.npcs) {
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      for (const n of g.npcs.list) {
        if (n.state === 'ko') continue;
        const dx = n.pos.x - v.pos.x, dz = n.pos.z - v.pos.z;
        const along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < v.dims.L / 2 + 0.6 && lat < v.dims.W / 2 + 0.3) {
          n.knock(v.pos.x, v.pos.z);
          g.sfx('bump');
          g.police.crime('pieton', true);
        }
      }
    }
  }
}
