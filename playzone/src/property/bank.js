import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { ATMS, WITHDRAW_MAX, hourlyBills, SAVINGS_RATE } from '../../shared/property.js';
import { StaticBuilder } from '../core/static-builder.js';
import { MATS } from '../core/materials.js';

// BANQUE : distributeurs de billets dans la rue (retrait / dépôt d'espèces), guichet de la banque,
// appli Banque du téléphone (comptes, livret d'épargne, factures, dettes).

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');

export class Bank {
  constructor(game) {
    this.game = game;
    // distributeurs : un seul maillage pour tous
    const sb = new StaticBuilder(Infinity);
    for (const a of ATMS) {
      const fx = Math.sin(a.ry), fz = Math.cos(a.ry);
      sb.box(a.x, 0, a.z, 0.9, 1.9, 0.5, '#3d5a80', a.ry);
      sb.box(a.x + fx * 0.26, 1.15, a.z + fz * 0.26, 0.6, 0.42, 0.04, '#7fd1ff', a.ry, 'glow');
      sb.box(a.x + fx * 0.3, 0.85, a.z + fz * 0.3, 0.5, 0.06, 0.12, '#14141c', a.ry);
      sb.box(a.x, 1.95, a.z, 0.95, 0.22, 0.55, '#ffd23f', a.ry);
    }
    this.mesh = sb.build(MATS, { shadows: true });
    game.engine.scene.add(this.mesh);
    for (const a of ATMS) {
      game.interactions.add({ x: a.x + Math.sin(a.ry) * 0.9, z: a.z + Math.cos(a.ry) * 0.9, r: 1.6, priority: 2, label: '🏧 Distributeur de billets', action: () => cashPanel(game, a.name) });
      game.collision.addCyl(a.x, a.z, 0.5, 0, 2, { noCamera: true });
    }
  }
}

// Retrait / dépôt d'espèces (distributeur ou guichet).
export function cashPanel(g, title = 'Distributeur de billets') {
  const m = g.ui.modal({
    title: `🏧 ${title}`, sub: 'Insérez votre carte... Composez votre code... (personne ne regarde, promis).',
    build: (body) => {
      const p = g.profile;
      body.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, '💳'), h('div.grow', h('div.t', `Compte : ${fmt(p.coins)} PC`), h('div.d', `Portefeuille : ${fmt(p.cash || 0)} PC en liquide`))));
      body.append(h('h4', 'Retirer des billets'));
      body.append(h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, [20, 50, 100, 200, 500, 1000, WITHDRAW_MAX].map((a) => h('button.btn.small', { disabled: p.coins < a, onclick: () => op('bank.withdraw', a) }, `${a} PC`))));
      body.append(h('h4', { style: { marginTop: '12px' } }, 'Déposer des espèces'));
      body.append(h('button.btn.small.teal', { disabled: !(p.cash > 0), onclick: () => op('bank.deposit', p.cash) }, `Tout déposer (${fmt(p.cash || 0)} PC)`));
      body.append(h('p.muted', { style: { marginTop: '10px' } }, 'Le liquide sert à payer en espèces (choix « Payer : Espèces » dans les boutiques). Attention : on peut se le faire voler !'));
    },
  });
  async function op(type, amount) {
    try { await g.net.request(type, { amount }); g.sfx('cash'); m.refresh(); } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
  }
  return m;
}

// Appli Banque (téléphone) : comptes, livret, factures, dette.
export function bankApp(g, b, refresh) {
  const p = g.profile;
  const bills = hourlyBills(p);
  const perDay = Math.round(p.savings * SAVINGS_RATE * 240);
  b.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, '💳'), h('div.grow', h('div.t', `Compte courant : ${fmt(p.coins)} PC`), h('div.d', `Liquide : ${fmt(p.cash || 0)} PC · gagné depuis le début : ${fmt(p.stats.earned)} PC`))));
  b.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, '🐷'), h('div.grow', h('div.t', `Livret d'épargne : ${fmt(p.savings || 0)} PC`), h('div.d', `Intérêts : 2 % par journée de jeu (≈ ${fmt(perDay)} PC / jour)`))));
  const row = h('div.row', { style: { gap: '6px', flexWrap: 'wrap', margin: '6px 0 12px' } });
  for (const a of [100, 1000, 10000]) row.append(h('button.btn.small', { disabled: p.coins < a, onclick: () => op('bank.save', a) }, `+${fmt(a)} au livret`));
  row.append(h('button.btn.small.ghost', { disabled: !(p.savings >= 1), onclick: () => op('bank.unsave', Math.floor(p.savings)) }, 'Tout récupérer'));
  b.append(row);
  b.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, '🧾'), h('div.grow', h('div.t', `Factures : ${bills.total} PC par heure de jeu`), h('div.d', `Loyer ${bills.rent} · crédit ${bills.loans} · charges ${bills.charges} · déjà payé ${fmt(p.bills?.paid || 0)} PC`))));
  if (p.debt > 0) b.append(h('div.list-item', h('span', { style: { fontSize: '26px' } }, '⚠️'), h('div.grow', h('div.t', `Dette : ${fmt(p.debt)} PC`), h('div.d', 'Au-delà de 2 500 PC de loyers impayés, on est expulsé d\'une location.')), h('button.btn.small', { onclick: () => op('bills.payDebt') }, 'Payer')));
  b.append(h('p.muted', 'Retraits et dépôts d\'espèces : distributeurs (🏧) devant la banque, les supermarchés, les stations-service...'));
  async function op(type, amount) {
    try { await g.net.request(type, { amount }); g.sfx('cash'); refresh?.(); } catch (e) { g.sfx('error'); g.ui.toast(e.message, 'bad'); }
  }
}
