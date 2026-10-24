import { h, fmt } from './dom.js';
import { LOTTO, lottoDay, nextDrawIn, defaultLotto } from '../../shared/lottery.js';

// LOTO (téléphone) : un ticket par jour réel, 10 PC, 1 chance sur 100 de gagner 1 000 000 PC.
// Le tirage est fait par l'autorité ; ici, on fait rouler les boules une à une.
export function lottoApp(g, b, phone) {
  const L = { ...defaultLotto(), ...(g.profile.lotto || {}) }, now = Date.now();
  const played = L.day === lottoDay(now);
  const wait = nextDrawIn(now), hh = Math.floor(wait / 3600_000), mm = Math.floor((wait % 3600_000) / 60_000);
  b.append(h('div.lotto-hero', h('div.lotto-big', `${fmt(LOTTO.prize)} PC`), h('div', `Ticket : ${LOTTO.price} PC · 1 chance sur ${LOTTO.odds} · 1 ticket par jour`)));
  const balls = h('div.lotto-balls');
  const res = h('div.lotto-res');
  b.append(balls, res);
  const showTicket = (t, reveal) => {
    balls.replaceChildren(...t.drawn.map((n) => h('span.ball.hide', String(n))));
    const kids = [...balls.children];
    kids.forEach((el, i) => setTimeout(() => { el.classList.remove('hide'); el.classList.toggle('hit', t.mine.includes(Number(el.textContent))); g.sfx?.('pop'); }, reveal ? 450 * (i + 1) : 0));
    setTimeout(() => {
      res.replaceChildren(h('div.muted', `Tes numéros : ${t.mine.join(' · ')}`), t.win ? h('div.lotto-win', `🎉 JACKPOT ! +${fmt(LOTTO.prize)} PC !`) : h('div', 'Perdu... retente ta chance demain !'));
      if (t.win && reveal) { g.sfx?.('levelup'); g.ui.toast(`🎰 Tu as gagné ${fmt(LOTTO.prize)} PC au loto !`, 'good', 7000); }
    }, reveal ? 450 * 7 : 0);
  };
  if (played && L.last[0]) showTicket(L.last[0], false);
  b.append(h('button.btn.block.lotto-buy', { disabled: played, onclick: async (e) => {
    e.target.disabled = true;
    phone.freeze = true;
    try { const r = await g.net.request('loto.play', {}); showTicket(r, true); setTimeout(() => { phone.freeze = false; if (phone.isOpen && phone.app === 'loto') phone.render(); }, 450 * 8 + 1500); }
    catch (err) { phone.freeze = false; g.ui.toast(err.message, 'bad'); e.target.disabled = false; }
  } }, played ? `Prochain tirage dans ${hh} h ${String(mm).padStart(2, '0')}` : `🎟️ Acheter un ticket (${g.profile.admin ? 'gratuit' : `${LOTTO.price} PC`})`));
  b.append(h('div.muted', { style: { marginTop: '10px' } }, `Tickets joués : ${L.played} · gains : ${fmt(L.won)} PC`));
  if (L.last.length > (played ? 1 : 0)) b.append(h('div.lotto-hist', L.last.slice(played ? 1 : 0, 8).map((t) => h('div', `${new Date(t.at).toLocaleDateString('fr-FR')} : ${t.win ? '🏆 gagné !' : 'perdu'} (${t.mine.join('-')})`))));
}
