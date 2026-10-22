import { h } from '../ui/dom.js';
import { CRIMES, FINES, LICENCE, CODE_QUESTIONS, codeTest, CODE_PASS } from '../../shared/justice.js';

// Commissariat (auto-école : code, examen du permis ; dossier), prison (gardien, laverie, évasion),
// appli Papiers du téléphone.

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');

export function policeDesk(g) {
  const L = g.profile.justice.licence;
  g.ui.dialog({ name: 'Agent·e d\'accueil', role: 'Commissariat Central', text: 'Bonjour ! Auto-école, dossier, plainte contre un pigeon... Que puis-je faire pour vous ?', choices: [
    { label: L.code ? '✅ Code obtenu' : `📝 Passer le code (${LICENCE.code} PC)`, action: (m) => { if (L.code) return; m.close(); codePanel(g); } },
    { label: L.permis ? '✅ Permis obtenu' : `🚗 Examen du permis (${LICENCE.permis} PC)`, action: async (m) => {
      if (L.permis) return;
      try { const r = await g.net.request('licence.examStart', {}); m.close(); g.police.startExam(r.route); } catch (e) { m.show(e.message, [{ label: 'D\'accord', ghost: true, action: (x) => x.close() }]); }
    } },
    { label: '🗂️ Mon dossier (amendes, casier)', action: (m) => { m.close(); dossierPanel(g); } },
    { label: 'Au revoir', ghost: true, action: (m) => m.close() },
  ] });
}

export function codePanel(g) {
  const seed = Math.floor(Math.random() * 1e9);
  const qs = codeTest(seed);
  const answers = new Array(qs.length).fill(-1);
  const m = g.ui.modal({
    title: '📝 Code de la route', sub: `${qs.length} questions, il faut ${CODE_PASS} bonnes réponses. ${LICENCE.code} PC.`,
    build: (body) => {
      qs.forEach((qi, i) => {
        const [q, choices] = CODE_QUESTIONS[qi];
        body.append(h('div.field', h('label', `${i + 1}. ${q}`), h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, choices.map((c, k) => h(`button.btn.small${answers[i] === k ? '' : '.ghost'}`, { onclick: () => { answers[i] = k; m.refresh(); } }, c)))));
      });
      body.append(h('button.btn', { disabled: answers.includes(-1), onclick: async () => {
        try {
          const r = await g.net.request('licence.code', { seed, answers });
          m.close();
          g.sfx(r.passed ? 'levelup' : 'fail');
          g.ui.dialog({ name: 'L\'examinateur·rice', role: 'Code de la route', text: r.passed ? `${r.score}/10 : code réussi ! Tu peux passer l'examen de conduite au comptoir.` : `${r.score}/10... il en fallait ${r.need}. Révise et retente !`, choices: [{ label: 'OK', ghost: true, action: (x) => x.close() }] });
        } catch (e) { g.ui.toast(e.message, 'bad'); }
      } }, 'Valider'));
    },
  });
}

export function dossierPanel(g) {
  g.ui.modal({ title: '🗂️ Mon dossier', sub: 'Permis, amendes, casier judiciaire.', build: (b) => papersApp(g, b) });
}

export function papersApp(g, b) {
  const j = g.profile.justice;
  b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, '🪪'), h('div.grow', h('div.t', `Permis : ${j.licence.permis ? `oui (${j.points}/12 points)` : j.licence.code ? 'code obtenu, examen à passer' : 'non'}`), h('div.d', 'Code et examen au Commissariat Central (auto-école). Sans permis, la police te verbalise (750 PC).'))));
  b.append(h('div.list-item', h('span', { style: { fontSize: '24px' } }, '🚨'), h('div.grow', h('div.t', `Recherché·e : ${'★'.repeat(j.stars) || 'non'}`), h('div.d', j.jail ? `En prison jusqu'à ${new Date(j.jail.until).toLocaleTimeString('fr-FR')}` : 'Pour semer la police : ne plus être vu·e pendant un moment.'))));
  b.append(h('h4', 'Amendes récentes'));
  if (!j.fines.length) b.append(h('p.muted', 'Aucune. Bravo !'));
  for (const f of j.fines.slice(-6).reverse()) b.append(h('div.d', `🧾 ${FINES[f.type]?.name || f.type} — ${fmt(f.amount)} PC`));
  b.append(h('h4', { style: { marginTop: '10px' } }, 'Casier judiciaire'));
  if (!j.record.length) b.append(h('p.muted', 'Vierge.'));
  for (const c of j.record.slice(-8).reverse()) b.append(h('div.d', `${c.end === 'condamné' ? '⛓️' : '🏃'} ${CRIMES[c.type]?.name || c.type} (${c.end})`));
  b.append(h('h4', { style: { marginTop: '10px' } }, 'Barème des peines (minutes réelles de prison)'));
  for (const c of Object.values(CRIMES)) b.append(h('div.d', `${c.name} : ${c.jail} min, ${'★'.repeat(c.stars)}`));
}

export function prisonGuard(g) {
  const jl = g.profile.justice.jail;
  if (!jl) {
    g.ui.dialog({ name: 'Gardien·ne', role: 'Prison de la Pomme Pourrie', text: 'Visite libre de 9 h à 18 h. Interdiction de cacher des limes dans les gâteaux.', choices: [{ label: 'Au revoir', ghost: true, action: (m) => m.close() }] });
    return;
  }
  const left = Math.max(0, Math.ceil((jl.until - g.now()) / 60000));
  g.ui.dialog({ name: 'Gardien·ne', role: 'Prison de la Pomme Pourrie', text: `Encore ${left} minute(s) à tirer. Tu peux travailler à la laverie (remise de peine)... et ne pense même pas à t'évader.`, choices: [
    { label: '🧺 Travailler à la laverie (+6 PC, -15 s de peine)', action: async (m) => { try { await g.net.request('jail.work', {}); g.sfx('coin'); g.player.setPose('cook', 2); m.close(); g.ui.toast('🧺 Une machine de linge pliée. Le gardien hoche la tête.', 'good'); } catch (e) { m.show(e.message, [{ label: 'OK', ghost: true, action: (x) => x.close() }]); } } },
    { label: 'Au revoir', ghost: true, action: (m) => m.close() },
  ] });
}

export async function tryEscape(g) {
  const ok = await g.ui.confirm('Tenter une évasion ?', 'Tu creuses avec ta cuillère... Réussite : liberté, mais 3 étoiles de recherche. Échec : 5 minutes de prison en plus. (Plus facile la nuit.)', 'Creuser !');
  if (!ok) return;
  g.player.setPose('hold-forward', 2);
  g.sfx('drill');
  try {
    const r = await g.net.request('jail.escape', {});
    if (r.escaped) { g.player.teleport(r.at.x, r.at.z, Math.PI); g.police.seenAt = g.now(); g.police.renderStars(); g.ui.toast('🏃 ÉVADÉ·E ! Les sirènes hurlent... Cours !', 'bad', 5000); }
    else { g.sfx('fail'); g.ui.toast('🥄 Le gardien t\'a surpris·e en train de creuser. +5 minutes !', 'bad', 4500); }
  } catch (e) { g.ui.toast(e.message, 'bad'); }
}
