import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { needsStatus, needsEffects, NEED_KEYS } from '../../shared/needs.js';
import { openShop } from '../ui/shop.js';

// Restaurants où l'on peut commander à table.
const TABLE_SERVICE = new Set(['bakery', 'cafe', 'cafe2', 'paillote', 'burger', 'pizzeria', 'tacos', 'homard', 'poisson']);
import { buildMergedGeometry, SHAPES } from '../core/static-builder.js';
import { actorMaterial } from '../core/materials.js';

// VIE QUOTIDIENNE : jauges (faim, énergie, humeur) affichées en haut à gauche, effets doux sur le
// personnage, s'asseoir / s'allonger, animation quand on mange ou boit.

const HUNGRY = ['Mon ventre gargouille...', 'J\'ai un petit creux. Un gros creux, même.', 'Je mangerais un poulet entier. (Pardon les poulets.)'];
const TIRED = ['*bâille*', 'Je ferais bien une petite sieste...', 'Mes paupières pèsent trois tonnes.'];
const GRUMPY = ['Rien ne va aujourd\'hui.', 'Même les pigeons m\'énervent.', 'J\'ai besoin d\'un câlin. Ou d\'une glace.'];
const SMELLY = ['Hmm... c\'est moi qui sens le fromage ?', 'Les mouches m\'adorent aujourd\'hui.', 'Une douche ne serait pas du luxe.'];
const NAMES = { faim: 'Faim', energie: 'Énergie', humeur: 'Humeur', hygiene: 'Propreté' };
const ICONS = { faim: '🍔', energie: '⚡', humeur: '🙂', hygiene: '🧼' };

function foodProp(it) {
  const drink = /café|chocolat|jus|soda|eau|cocktail/i.test(it.name);
  return buildMergedGeometry((sb) => {
    if (drink) { sb.cyl(0, 0, 0, 0.09, 0.22, '#f4f1ea', 10); sb.cyl(0, 0.2, 0, 0.08, 0.03, '#6f4518', 10); }
    else if (/burger/i.test(it.name)) { sb.cyl(0, 0, 0, 0.14, 0.06, '#d4a373', 12); sb.cyl(0, 0.06, 0, 0.15, 0.05, '#5a3825', 12); sb.cyl(0, 0.11, 0, 0.15, 0.02, '#7ac74f', 12); sb.sphere(0, 0.16, 0, 0.14, '#e9c46a', 10, 'main', 0.5); }
    else if (/pizza/i.test(it.name)) { sb.add(SHAPES.cone(3), { y: 0.02, sx: 0.32, sy: 0.04, sz: 0.32, color: '#f4a261' }); sb.sphere(0.04, 0.05, 0, 0.03, '#d62828', 6); }
    else sb.sphere(0, 0.08, 0, 0.12, '#e9c46a', 10);
  });
}

export class Life {
  constructor(game) {
    this.game = game;
    this.el = h('div.needs',
      this.bars = NEED_KEYS.map((k) => h(`div.need.${k}`, h('span', ICONS[k]), h('div.nb', h('div')))));
    game.hud.tl.insertBefore(this.el, game.hud.tracker);
    this.t = 0; this.talkT = 30;
    game.player.onSit = () => {};
    game.on('needs', () => this.refresh());
    // au restaurant : assis à une table, on commande au serveur sans se lever
    game.interactions.add({
      r: 1e9, priority: 4,
      x: () => game.player.pos.x, z: () => game.player.pos.z,
      enabled: () => !!this.tableShop(),
      label: '🍽️ Commander à table',
      action: () => { const b = this.tableShop(); game.sfx('ring'); openShop(game, b.shop, b); },
    });
  }

  // Bâtiment de restauration où l'on est assis (pour commander à table).
  tableShop() {
    const g = this.game;
    if (!g.player.seated || g.player.seated.lie) return null;
    const b = g.interiors?.inside;
    return b && TABLE_SERVICE.has(b.shop) ? b : null;
  }

  // Joue l'animation de repas (objet en main, miettes, "miam").
  play(it) {
    const g = this.game;
    const geo = foodProp(it);
    const prop = new THREE.Mesh(geo, actorMaterial);
    prop.rotation.x = Math.PI;
    g.avatar.hold(prop);
    g.player.setPose('eat', 2.6);
    g.sfx('pop');
    const drink = /café|chocolat|jus|soda|eau|cocktail/i.test(it.name);
    g.labels.bubble(g.avatar.root, drink ? 'Glou glou... Ahhh !' : 'Miam miam !', 2200, 'player');
    let n = 0;
    const iv = setInterval(() => {
      const p = g.player.pos;
      if (!drink) g.fx.emit({ x: p.x + Math.sin(g.player.yaw) * 0.3, y: p.y + 1.55, z: p.z + Math.cos(g.player.yaw) * 0.3, n: 3, colors: ['#e9c46a', '#d4a373'], speed: 1.2, gravity: 8, life: 0.6, size: 0.06 });
      if (++n > 8) { clearInterval(iv); g.avatar.hold(null); }
    }, 300);
  }

  sit(seat) { this.game.player.sit(seat); }

  refresh() {
    const p = this.game.profile;
    if (!p?.needs) return;
    // l'admin ne perd rien : faim, énergie, humeur et hygiène restent pleines
    const st = p.admin ? { faim: 100, energie: 100, humeur: 100, hygiene: 100 } : needsStatus(p.needs, this.game.now());
    this.status = st;
    NEED_KEYS.forEach((k, i) => {
      const v = st[k];
      const bar = this.bars[i].querySelector('.nb > div');
      bar.style.width = `${Math.round(v)}%`;
      this.bars[i].classList.toggle('low', v < 20);
      this.bars[i].title = `${NAMES[k]} : ${Math.round(v)} / 100`;
    });
    const fx = needsEffects(st);
    this.game.player.needsSpeed = fx.speed;
    this.game.player.noSprint = fx.noSprint;
    return { st, fx };
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1;
    const r = this.refresh();
    if (!r) return;
    // de temps en temps, le personnage le fait savoir (avec humour)
    this.talkT -= 1;
    if (this.talkT <= 0) {
      this.talkT = 70;
      const g = this.game;
      const lines = r.fx.hungry ? HUNGRY : r.fx.tired ? TIRED : r.fx.smelly ? SMELLY : r.fx.grumpy ? GRUMPY : null;
      if (lines && g.player.zone === 'world') {
        g.labels.bubble(g.avatar.root, lines[Math.floor(Math.random() * lines.length)], 3000, 'player');
        if (r.fx.hungry) g.ui.toast('🍔 Tu as faim : boulangerie, burger, pizzeria, supermarché... ou cuisine chez toi !', '', 4500);
        else if (r.fx.tired) g.ui.toast('⚡ Tu es fatigué·e : dors dans ton lit, bois un café ou passe à l\'hôpital.', '', 4500);
        else if (r.fx.smelly) g.ui.toast('🧼 Tu commences à sentir fort : une douche chez toi (ou à la salle de sport) !', '', 4500);
      }
    }
    // mouches autour d'un personnage pas très propre
    if (r.fx.smelly && !this.game.vehicles?.driving) {
      const p = this.game.player.pos;
      for (let i = 0; i < 3; i++) this.game.fx.emit({ x: p.x + (Math.random() - 0.5) * 0.8, y: p.y + 1.5 + Math.random() * 0.6, z: p.z + (Math.random() - 0.5) * 0.8, n: 1, colors: ['#1b1b1b'], speed: 1.6, gravity: 0, life: 0.9, size: 0.05, jitter: 0.5 });
    }
  }
}
