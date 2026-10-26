import { h, fmt } from '../ui/dom.js';
import { GAMES, gamesFor } from '../../shared/casino-games.js';
import { slotsPanel, roulettePanel, blackjackPanel, pokerPanel } from './casino.js';

// SALLE DES JEUX : le catalogue du casino (40 jeux au Grand Casino, 16 ailleurs), classé par catégorie,
// et une table générique pour chaque jeu (mise, choix, tirage animé, résultat). PlayCoins uniquement.
const BETS = [10, 50, 100, 500, 1000, 5000];
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
const PANELS = { slots: slotsPanel, roulette: roulettePanel, bj: blackjackPanel, poker: pokerPanel };
const SPIN = { 'Dés & pièces': ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'], Cartes: ['🂡', '🂱', '🃁', '🃑', '🂮', '🂾'], 'Roues & loteries': ['🎡', '🔢', '🎟️', '✨'], Arcade: ['🔻', '🚀', '💣', '🎈'], Courses: ['🏇', '🐕', '🐌', '🏁'], Machines: ['🍒', '🔔', '💎', '7️⃣'], Tables: ['🎡'] };

export function casinoHall(g, b, cat = null) {
  const ids = gamesFor(b).filter((id) => !cat || GAMES[id].cat === cat);
  const cats = [...new Set(ids.map((id) => GAMES[id].cat))];
  const m = g.ui.modal({
    title: `🎲 ${b?.grand ? 'Grand Casino de PLAYZONE' : b?.name || 'Casino'}${cat ? ` · ${cat}` : ''}`,
    sub: `${ids.length} jeux${cat ? ' dans cette salle' : ''}. On joue uniquement avec des PlayCoins (l'argent du jeu). Sur la durée, la maison gagne toujours un peu.`,
    width: 'min(720px, 96vw)', className: 'casino-hall',
    build: (body) => {
      for (const c of cats) {
        body.append(h('h4.hall-cat', c));
        body.append(h('div.hall-grid', ids.filter((id) => GAMES[id].cat === c).map((id) => {
          const G = GAMES[id];
          return h('button.hall-game', { onclick: () => { m.close(); if (G.panel) PANELS[G.panel](g); else gameTable(g, id, b); } }, h('span.e', G.emoji), h('b', G.name), h('small', G.desc));
        })));
      }
      if (!b?.grand) body.append(h('p.muted', { style: { marginTop: '10px' } }, '🌟 40 jeux différents au Grand Casino de PLAYZONE, Avenue de Prestige.'));
    },
  });
  return m;
}

export function gameTable(g, id, b) {
  const G = GAMES[id];
  let bet = 50, choice = G.choices?.[0]?.id ?? null, busy = false, last = null, show = G.emoji;
  const m = g.ui.modal({
    title: `${G.emoji} ${G.name}`, sub: G.desc, width: 'min(560px, 96vw)', className: 'casino-table',
    onClose: () => { if (!busy) casinoHall(g, b, G.cat); },
    build: (body) => {
      body.append(h('div.game-show', show));
      body.append(h('div.game-msg', last ? (last.net > 0 ? `🎉 Gagné : +${fmt(last.net)} PC (×${last.mult})` : last.net === 0 ? 'Mise rendue.' : `Perdu (−${fmt(-last.net)} PC)`) : 'Choisis ta mise et lance !'));
      if (G.choices) body.append(h('div.field', h('label', 'Ton choix'), h('div.opt-row', G.choices.map((c) => h(`button.opt${choice === c.id ? '.sel' : ''}`, { onclick: () => { choice = c.id; m.refresh(); } }, c.label, c.hint ? h('small', ` ${c.hint}`) : null)))));
      body.append(h('div.field', h('label', 'Mise'), h('div.opt-row', BETS.map((v) => h(`button.opt${bet === v ? '.sel' : ''}`, { onclick: () => { bet = v; m.refresh(); } }, `${fmt(v)} PC`)))));
      body.append(h('div.casino-coins', `💳 ${fmt(g.profile.coins)} PC`, h('span.muted', ' · PlayCoins uniquement')));
      body.append(h('button.btn.big', { disabled: busy, onclick: async () => {
        if (busy) return;
        busy = true; m.refresh();
        const el = body.querySelector('.game-show'), frames = SPIN[G.cat] || ['🎲'];
        let k = 0;
        const iv = setInterval(() => { el.textContent = frames[k++ % frames.length].repeat(3); }, 90);
        g.sfx('click');
        let r = null;
        try { r = await g.net.request('casino.play', { game: id, bet, choice }); } catch (e) { g.ui.toast(e.message, 'bad'); g.sfx('error'); }
        await sleepMs(700);
        clearInterval(iv);
        busy = false;
        if (r) {
          last = r; show = r.show;
          if (r.net > 0) { g.sfx(r.mult >= 20 ? 'levelup' : 'cash'); if (r.mult >= 20) g.ui.toast(`🎰 ÉNORME : ×${r.mult} au ${G.name} !`, 'good', 5000); } else g.sfx(r.net === 0 ? 'pop' : 'fail');
        }
        m.refresh();
      } }, busy ? '…' : `${G.emoji} Jouer (${fmt(bet)} PC)`));
      body.append(h('button.btn.ghost.small', { onclick: () => m.close() }, '↩︎ Retour à la salle'));
    },
  });
  return m;
}
