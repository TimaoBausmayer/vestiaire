import { h, clear } from './dom.js';

// TUTORIEL : proposé au premier lancement (on peut le passer), toujours consultable depuis l'appli
// « Aide » du téléphone. Une page par grand thème du jeu.

export const TUTO_PAGES = [
  { icon: '👋', title: 'Bienvenue à PLAYZONE !', text: [
    'Une ville entière à vivre : travailler, gagner des PlayCoins, acheter une maison, une voiture, faire du sport, sortir avec des amis... ou faire des bêtises (la police veille).',
    'Le temps passe : 10 minutes réelles = 1 heure de jeu. Une journée de jeu dure 4 heures.',
  ] },
  { icon: '🎮', title: 'Se déplacer', text: [
    'ZQSD / WASD / flèches : marcher · Maj : courir · Espace : sauter · E : interagir (le bouton en bas de l\'écran indique quoi).',
    'Clic glissé : tourner la caméra · Molette : zoom · P : téléphone · M : carte et GPS · Entrée : chat · G : donner un coup (illégal !).',
    'En voiture : Z/S accélérer / freiner · Q/D tourner · Espace : frein à main · H : klaxon · L : phares · K : clés (verrouiller).',
  ] },
  { icon: '💳', title: 'Argent, banque et factures', text: [
    'Tes PlayCoins sont sur ton compte (carte) ; tu as aussi un peu d\'argent liquide (💵). Retraits et dépôts aux distributeurs 🏧.',
    'Le loyer, ton crédit et les charges sont prélevés à chaque minute de jeu (jamais quand tu es déconnecté·e). Pas assez d\'argent ? Ça devient une dette... et on peut être expulsé·e.',
    'Le livret d\'épargne (appli Banque) rapporte des intérêts. La bourse et les entreprises : appli Business.',
  ] },
  { icon: '💼', title: 'Travailler', text: [
    'Petites missions (livreur, pompier, cuisinier) ou emploi salarié : dans les commerces, bureaux, hôpital, garages... cherche le tableau « 💼 Emplois ».',
    'Pointe pour commencer ton service : tu es payé·e au temps passé sur place, et des tâches apparaissent (balise verte). Bonne performance = primes, augmentation. Absences = renvoi !',
    'Les métiers qualifiés (mécanicien, infirmier, médecin, banquier...) demandent un diplôme : formations payantes à l\'école, puis examen. Envie d\'être patron·ne ? Registre du commerce à la mairie.',
  ] },
  { icon: '❤️', title: 'Prendre soin de soi', text: [
    'Jauges : santé, faim, énergie, humeur, propreté. Mange (restaurants, supermarché, cuisine chez toi), dors dans ton lit, douche-toi.',
    'Trop manger sans faim fait grossir, ne pas manger fait maigrir et rend faible. Pompes : appuie sur Espace (de moins en moins quand tu es musclé·e). Salle de sport : machines qui tournent seules.',
    'Chute ou accident = blessure (on boite) : repos ou hôpital. Tu vieillis en jouant (6 h de jeu = 1 an). Vêtements chers, parfum, coiffeur : tu attires les regards.',
  ] },
  { icon: '🏡', title: 'Logement et véhicules', text: [
    'Agence immobilière : louer, acheter comptant ou à crédit (appartements ≈ 150 000, maisons ≈ 300 000, bord de mer ≈ 500 000). Tes meubles déménagent avec toi.',
    'Voitures neuves (concession), d\'occasion, location quelques minutes. Elles restent garées où tu les laisses. Essence aux stations, réparations au garage.',
  ] },
  { icon: '🚔', title: 'Police et justice', text: [
    'Délits : coups, vol à la tire, vol de voiture, piéton renversé, braquage... Si quelqu\'un te voit, la police te recherche (étoiles ★).',
    'Pour semer la police : ne plus être vu·e pendant un moment (cache-toi dans un bâtiment !). Si tu te fais attraper : prison en minutes RÉELLES (ex. coups = 10 min), argent liquide saisi.',
    'En prison : laverie (remise de peine) ou tentative d\'évasion (risqué). Radars et feux rouges = amendes et points. Il faut le code et le permis (Commissariat) pour conduire une voiture.',
    'En ligne, les joueurs policiers en service peuvent arrêter les joueurs recherchés. Et un policier qui commet un délit va aussi en prison !',
  ] },
  { icon: '🌍', title: 'Jouer à plusieurs', text: [
    'Solo ou en ligne : ta progression te suit. En ligne : chat, groupes, inviter des amis chez toi, investir dans les entreprises des autres, mini-jeux.',
    'Sois sympa : pas d\'infos personnelles dans le chat, et signale les comportements gênants (appli Joueurs).',
    'Cet écran reste disponible dans l\'appli « Aide » du téléphone. Bonne vie à PLAYZONE !',
  ] },
];

export function openTutorial(game, start = 0) {
  let i = start;
  const m = game.ui.modal({
    title: '📘 Tutoriel', sub: 'Tu peux le passer à tout moment et le revoir dans l\'appli Aide du téléphone.',
    build: (body) => {
      const p = TUTO_PAGES[i];
      body.append(h('div', { style: { textAlign: 'center', fontSize: '46px' } }, p.icon), h('h3', { style: { textAlign: 'center', margin: '6px 0 12px' } }, p.title));
      for (const t of p.text) body.append(h('p', { style: { lineHeight: '1.5' } }, t));
      body.append(h('div.row', { style: { justifyContent: 'space-between', marginTop: '14px', gap: '8px' } },
        h('button.btn.small.ghost', { disabled: i === 0, onclick: () => { i--; m.refresh(); } }, '← Précédent'),
        h('span.muted', `${i + 1} / ${TUTO_PAGES.length}`),
        i < TUTO_PAGES.length - 1 ? h('button.btn.small', { onclick: () => { i++; m.refresh(); } }, 'Suivant →') : h('button.btn.small', { onclick: () => m.close() }, 'C\'est parti !')));
    },
  });
  try { localStorage.setItem('playzone.tutoSeen', '1'); } catch { /* stockage indisponible */ }
  return m;
}

export function maybeOfferTutorial(game) {
  let seen = false;
  try { seen = !!localStorage.getItem('playzone.tutoSeen'); } catch { /* stockage indisponible */ }
  if (seen || game.qs?.has('auto')) return;
  game.ui.dialog({ name: '📘 Tutoriel', role: 'PLAYZONE', text: 'Première visite ? Un petit tour des règles (argent, travail, santé, police...) ? Tu pourras le revoir dans l\'appli Aide du téléphone.', choices: [
    { label: 'Voir le tutoriel', action: (m) => { m.close(); openTutorial(game); } },
    { label: 'Passer', ghost: true, action: (m) => { m.close(); try { localStorage.setItem('playzone.tutoSeen', '1'); } catch { /* rien */ } } },
  ] });
}

export function helpApp(game, b) {
  TUTO_PAGES.forEach((p, i) => b.append(h('div.list-item', { style: { cursor: 'pointer' }, onclick: () => { game.phone.close(); openTutorial(game, i); } }, h('span', { style: { fontSize: '24px' } }, p.icon), h('div.grow', h('div.t', p.title)), h('span.pill', 'Lire'))));
  void clear;
}
