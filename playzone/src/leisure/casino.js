import { h, clear, fmt } from '../ui/dom.js';
import {
  CASINO, SLOT_SYMBOLS, SLOT_PAYS, SLOT_CHERRY, ROULETTE_BETS, ROULETTE_ORDER, rouletteColor, POKER_PAYS, suitOf, defaultCasino,
} from '../../shared/casino.js';

// CASINO ROYAL POMME (interface). Toutes les mises sont des PlayCoins, la monnaie du jeu : aucun argent
// réel. Le hasard est tiré par l'autorité (le serveur en ligne) ; l'interface ne fait qu'animer le résultat.

const BETS = [10, 50, 100, 500, 1000];
const EMOJI = Object.fromEntries(SLOT_SYMBOLS.map((s) => [s.id, s.emoji]));
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
const coinsLine = (g) => h('div.casino-coins', `💳 ${fmt(g.profile.coins)} PC`, h('span.muted', ' · PlayCoins uniquement (argent du jeu)'));

function betRow(get, set, m) {
  return h('div.field', h('label', 'Mise'), h('div.opt-row', BETS.map((b) => h(`button.opt${get() === b ? '.sel' : ''}`, { onclick: () => { set(b); m.refresh(); } }, `${b} PC`))));
}

async function req(g, type, payload) {
  try { return await g.net.request(type, payload); } catch (e) { g.ui.toast(e.message, 'bad'); g.sfx('error'); return null; }
}

function resultToast(g, net, extra = '') {
  if (net > 0) { g.sfx('cash'); g.ui.toast(`🎉 Gagné : +${fmt(net)} PC ${extra}`, 'good'); } else if (net === 0) g.ui.toast(`Mise rendue. ${extra}`); else g.ui.toast(`Perdu : ${fmt(net)} PC ${extra}`, 'bad', 1800);
}

// ------------------------------------------------------------------------------------- machine à sous
export function slotsPanel(g) {
  let bet = 10, spinning = false, last = null;
  const m = g.ui.modal({
    title: '🎰 Machine à sous « Pomme d\'Or »', sub: 'Trois symboles identiques, ou des cerises 🍒. La machine rend environ 92 % des mises sur la durée : la maison gagne toujours à la fin.',
    width: 'min(560px, 96vw)',
    build: (b, m) => {
      const reels = h('div.reels', [0, 1, 2].map((i) => h('div.reel', last ? EMOJI[last.reels[i]] : ['🍒', '🔔', '7️⃣'][i])));
      b.append(reels, h('div.slot-msg', last ? (last.mult ? `×${last.mult} → +${fmt(last.paid)} PC` : 'Rien cette fois…') : 'Choisis ta mise et tire le levier !'));
      b.append(betRow(() => bet, (v) => { bet = v; }, m), coinsLine(g));
      b.append(h('details.paytable', h('summary', 'Table des gains'),
        h('div.pay-grid', Object.entries(SLOT_PAYS).reverse().map(([id, x]) => h('div', `${EMOJI[id].repeat(3)} ×${x}`)), h('div', `🍒🍒 ×${SLOT_CHERRY.two}`), h('div', `🍒 en 1er ×${SLOT_CHERRY.one}`))));
      b.append(h('button.btn.big', { disabled: spinning, onclick: async () => {
        if (spinning) return;
        spinning = true;
        const els = [...reels.children];
        const syms = SLOT_SYMBOLS.map((s) => s.emoji);
        let k = 0;
        const iv = setInterval(() => { els.forEach((e, i) => { if (!e.dataset.stop) e.textContent = syms[(k + i * 3) % syms.length]; }); k++; }, 70);
        g.sfx('click');
        const r = await req(g, 'casino.slots', { bet });
        if (!r) { clearInterval(iv); spinning = false; m.refresh(); return; }
        for (let i = 0; i < 3; i++) { await sleepMs(380); els[i].dataset.stop = '1'; els[i].textContent = EMOJI[r.reels[i]]; g.sfx('pop'); }
        clearInterval(iv);
        last = r; spinning = false;
        resultToast(g, r.net, r.mult >= 100 ? '— JACKPOT !' : '');
        m.refresh();
      } }, spinning ? '…' : `🎰 Tirer le levier (${bet} PC)`));
    },
  });
  return m;
}

// ------------------------------------------------------------------------------------- roulette
function drawWheel(cv, angle, ballAngle) {
  const c = cv.getContext('2d'), W = cv.width, R = W / 2 - 6;
  c.clearRect(0, 0, W, W);
  c.save(); c.translate(W / 2, W / 2);
  c.beginPath(); c.arc(0, 0, R + 4, 0, Math.PI * 2); c.fillStyle = '#5a3416'; c.fill();
  const n = ROULETTE_ORDER.length, step = (Math.PI * 2) / n;
  ROULETTE_ORDER.forEach((num, i) => {
    const a0 = angle + i * step - step / 2;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0, a0 + step); c.closePath();
    const col = rouletteColor(num);
    c.fillStyle = col === 'vert' ? '#1f8a3b' : col === 'rouge' ? '#c1121f' : '#141414'; c.fill();
    c.save(); c.rotate(a0 + step / 2); c.fillStyle = '#fff'; c.font = `bold ${Math.round(W / 26)}px sans-serif`; c.textAlign = 'center'; c.fillText(String(num), R - W / 22, 4); c.restore();
  });
  c.beginPath(); c.arc(0, 0, R * 0.55, 0, Math.PI * 2); c.fillStyle = '#7a4a22'; c.fill();
  c.beginPath(); c.arc(0, 0, R * 0.18, 0, Math.PI * 2); c.fillStyle = '#d4a017'; c.fill();
  if (ballAngle !== null) { c.beginPath(); c.arc(Math.cos(ballAngle) * R * 0.78, Math.sin(ballAngle) * R * 0.78, W / 40, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); }
  c.restore();
}

export function roulettePanel(g) {
  let chip = 10, bets = [], spinning = false, last = null, num = 17;
  let wheelAngle = 0;
  const m = g.ui.modal({
    title: '🎡 Roulette européenne', sub: 'Un seul zéro. Chances simples payées 1 pour 1, douzaines 2 pour 1, plein 35 pour 1. Le zéro fait perdre les chances simples.',
    width: 'min(680px, 96vw)',
    build: (b, m) => {
      const cv = h('canvas.roulette-wheel', { width: 260, height: 260 });
      drawWheel(cv, wheelAngle, null);
      const total = bets.reduce((s, x) => s + x.amount, 0);
      const add = (kind, value = null) => {
        const e = bets.find((x) => x.kind === kind && x.value === value);
        if (e) e.amount += chip; else if (bets.length < 8) bets.push({ kind, value, amount: chip });
        g.sfx('click'); m.refresh();
      };
      const board = h('div.roulette-board',
        ...['rouge', 'noir', 'pair', 'impair', 'manque', 'passe', 'd1', 'd2', 'd3'].map((k) => h(`button.rbet.${k}`, { onclick: () => add(k) }, ROULETTE_BETS[k].label)),
        h('div.rbet-num', h('input', { type: 'number', min: 0, max: 36, value: num, oninput: (e) => { num = Math.max(0, Math.min(36, Math.floor(Number(e.target.value) || 0))); } }), h('button.rbet', { onclick: () => add('numero', num) }, 'Plein sur ce numéro')));
      b.append(h('div.roulette-top', cv, h('div.grow',
        h('div.slot-msg', last ? `Sorti : ${last.n} ${rouletteColor(last.n)} — ${last.net >= 0 ? `+${fmt(last.net)}` : fmt(last.net)} PC` : 'Faites vos jeux !'),
        h('div.field', h('label', 'Jeton'), h('div.opt-row', BETS.map((v) => h(`button.opt${chip === v ? '.sel' : ''}`, { onclick: () => { chip = v; m.refresh(); } }, `${v}`)))),
        h('div.muted', bets.length ? bets.map((x) => `${ROULETTE_BETS[x.kind].label}${x.kind === 'numero' ? ` ${x.value}` : ''} : ${x.amount}`).join(' · ') : 'Aucune mise.'),
        coinsLine(g))));
      b.append(board);
      b.append(h('div.row-btns',
        h('button.btn.ghost', { disabled: spinning || !bets.length, onclick: () => { bets = []; m.refresh(); } }, 'Effacer'),
        h('button.btn.big', { disabled: spinning || !bets.length, onclick: async () => {
          spinning = true; m.refresh();
          const r = await req(g, 'casino.roulette', { bets: bets.map((x) => ({ kind: x.kind, value: x.value ?? undefined, amount: x.amount })) });
          if (!r) { spinning = false; m.refresh(); return; }
          // animation : la roue tourne, la bille tourne en sens inverse et finit dans la case tirée
          const cvs = m.body.querySelector('canvas.roulette-wheel');
          const idx = ROULETTE_ORDER.indexOf(r.n), step = (Math.PI * 2) / ROULETTE_ORDER.length;
          const T = 2600, a0 = wheelAngle, a1 = a0 + Math.PI * 4;
          const ballEnd = a1 + idx * step, ball0 = ballEnd + Math.PI * 8;
          const t0 = performance.now();
          g.sfx('whoosh');
          await new Promise((res) => {
            const tick = () => {
              const k = Math.min(1, (performance.now() - t0) / T), e = 1 - (1 - k) ** 3;
              wheelAngle = a0 + (a1 - a0) * e;
              if (cvs) drawWheel(cvs, wheelAngle, ball0 + (ballEnd - ball0) * e);
              if (k < 1) requestAnimationFrame(tick); else res();
            };
            tick();
          });
          wheelAngle %= Math.PI * 2;
          last = r; spinning = false; bets = [];
          resultToast(g, r.net, `(sorti : ${r.n})`);
          m.refresh();
          const c2 = m.body.querySelector('canvas.roulette-wheel');
          if (c2) drawWheel(c2, wheelAngle, wheelAngle + idx * step);
        } }, spinning ? 'La bille tourne…' : `🎡 Lancer la bille (${fmt(total)} PC)`)));
    },
  });
  return m;
}

// ------------------------------------------------------------------------------------- cartes
const cardEl = (c, extra = '') => (c === '?' ? h(`div.pcard.back${extra}`, '🂠') : h(`div.pcard${['♥', '♦'].includes(suitOf(c)) ? '.red' : ''}${extra}`, c.slice(0, -1), h('span', suitOf(c))));

export function blackjackPanel(g) {
  let bet = 50, st = null, busy = false;
  const act = async (type, payload = {}) => {
    if (busy) return;
    busy = true;
    const r = await req(g, type, payload);
    busy = false;
    if (r) { st = r; g.sfx(r.over ? (r.net > 0 ? 'cash' : 'pop') : 'click'); if (r.over) resultToast(g, r.net, `(${r.result})`); }
    m.refresh();
  };
  const m = g.ui.modal({
    title: '🃏 Blackjack', sub: 'Approche 21 sans dépasser. Le croupier tire jusqu\'à 17. Blackjack payé 3 pour 2. Doubler sur les deux premières cartes (pas de séparation).',
    width: 'min(620px, 96vw)',
    onClose: () => { if (st && !st.over) g.net.request('casino.bj.stand', {}).catch(() => {}); },
    build: (b, m) => {
      b.append(h('div.bj-table',
        h('div.bj-row', h('b', `Croupier${st?.dealerValue != null ? ` : ${st.dealerValue}` : ''}`), h('div.cards', (st?.dealer || ['?', '?']).map((c) => cardEl(c)))),
        h('div.bj-row', h('b', `Toi${st ? ` : ${st.value}` : ''}`), h('div.cards', (st?.player || []).map((c) => cardEl(c))))));
      if (st?.over) b.append(h('div.slot-msg', `${st.result.toUpperCase()} — ${st.net >= 0 ? `+${fmt(st.net)}` : fmt(st.net)} PC`));
      if (!st || st.over) {
        b.append(betRow(() => bet, (v) => { bet = v; }, m), coinsLine(g));
        b.append(h('button.btn.big', { disabled: busy, onclick: () => act('casino.bj.deal', { bet }) }, `Distribuer (${bet} PC)`));
      } else {
        b.append(coinsLine(g), h('div.row-btns',
          h('button.btn', { disabled: busy, onclick: () => act('casino.bj.hit') }, 'Carte !'),
          h('button.btn', { disabled: busy, onclick: () => act('casino.bj.stand') }, 'Je reste'),
          st.canDouble ? h('button.btn.ghost', { disabled: busy, onclick: () => act('casino.bj.double') }, `Doubler (+${st.bet} PC)`) : null));
      }
    },
  });
  return m;
}

export function pokerPanel(g) {
  let bet = 20, st = null, hold = [false, false, false, false, false], busy = false;
  const m = g.ui.modal({
    title: '🂡 Vidéo poker « Valet ou mieux »', sub: 'Tu reçois 5 cartes, tu gardes celles que tu veux (clic), puis tu tires une fois. Paiement pour 1 PC misé.',
    width: 'min(640px, 96vw)',
    build: (b, m) => {
      const dealing = st && !st.final;
      b.append(h('div.cards.vp', (st?.cards || ['?', '?', '?', '?', '?']).map((c, i) => {
        const el = cardEl(c, dealing && hold[i] ? '.held' : '');
        if (dealing) el.addEventListener('click', () => { hold[i] = !hold[i]; g.sfx('click'); m.refresh(); });
        return h('div.vp-slot', el, h('small', dealing ? (hold[i] ? 'GARDÉE' : 'clic = garder') : ''));
      })));
      b.append(h('div.slot-msg', st ? (st.final ? `${st.hand.label} — ${st.net >= 0 ? `+${fmt(st.net)}` : fmt(st.net)} PC` : `Main actuelle : ${st.hand.label}`) : 'Distribue pour commencer.'));
      if (dealing) {
        b.append(h('button.btn.big', { disabled: busy, onclick: async () => {
          busy = true;
          const r = await req(g, 'casino.poker.draw', { hold });
          busy = false;
          if (r) { st = { ...r, final: true }; resultToast(g, r.net, `(${r.hand.label})`); }
          m.refresh();
        } }, 'Tirer'));
      } else {
        b.append(betRow(() => bet, (v) => { bet = v; }, m), coinsLine(g));
        b.append(h('button.btn.big', { disabled: busy, onclick: async () => {
          busy = true;
          const r = await req(g, 'casino.poker.deal', { bet });
          busy = false;
          if (r) { st = { ...r, final: false }; hold = [false, false, false, false, false]; g.sfx('pop'); }
          m.refresh();
        } }, `Distribuer (${bet} PC)`));
      }
      b.append(h('details.paytable', h('summary', 'Table des gains'), h('div.pay-grid', POKER_PAYS.map(([, label, x]) => h('div', `${label} ×${x}`)))));
    },
  });
  return m;
}

// ------------------------------------------------------------------------------------- accueil : jeu responsable
export function casinoDesk(g) {
  const m = g.ui.modal({
    title: '🎩 Accueil du Casino Royal Pomme', sub: 'On joue uniquement avec des PlayCoins, l\'argent du jeu. Aucun argent réel n\'entre ni ne sort, jamais.',
    build: (b, m) => {
      const c = { ...defaultCasino(), ...(g.profile.casino || {}) };
      const today = new Date(g.now()).toISOString().slice(0, 10);
      const net = c.day === today ? c.net : 0;
      b.append(h('div.stat-grid',
        h('div.stat', h('b', `${net >= 0 ? '+' : ''}${fmt(net)} PC`), h('span', 'Bilan du jour')),
        h('div.stat', h('b', `${fmt(c.limit)} PC`), h('span', 'Limite de pertes / jour')),
        h('div.stat', h('b', String(c.played)), h('span', 'Parties jouées')),
        h('div.stat', h('b', `${fmt(c.won - c.lost)} PC`), h('span', 'Bilan total'))));
      if ((g.profile.body?.age ?? 18) < CASINO.minAge) b.append(h('p.warn', '🔞 Le casino est interdit aux moins de 18 ans.'));
      if (c.excludedUntil > g.now()) b.append(h('p.warn', `⛔ Auto-exclusion active jusqu'à ${new Date(c.excludedUntil).toLocaleString('fr-FR')}.`));
      b.append(h('p.muted', `Mises de ${CASINO.minBet} à ${fmt(CASINO.maxBet)} PC. Sur la durée, la banque gagne : joue pour le plaisir, pas pour « te refaire ».`));
      let lim = c.limit;
      b.append(h('div.field', h('label', 'Ma limite de pertes par jour'), h('div.opt-row',
        ...[500, 2000, 5000, 20000].map((v) => h(`button.opt${lim === v ? '.sel' : ''}`, { onclick: async () => { if (await req(g, 'casino.limit', { limit: v })) { g.ui.toast(`Limite fixée à ${fmt(v)} PC par jour.`, 'good'); m.refresh(); } } }, `${fmt(v)} PC`)))));
      b.append(h('button.btn.ghost', { onclick: async () => {
        if (!(await g.ui.confirm('M\'exclure 24 h ?', 'Tu ne pourras plus miser au casino pendant 24 heures réelles. Pas de retour en arrière.', 'M\'exclure'))) return;
        if (await req(g, 'casino.exclude', {})) { g.ui.toast('⛔ Auto-exclusion de 24 h activée. Prends soin de toi !', 'good'); m.refresh(); }
      } }, '⛔ M\'exclure du casino pendant 24 h'));
    },
  });
  return m;
}
