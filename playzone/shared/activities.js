// ACTIVITÉS DANS LES BÂTIMENTS (validées par l'autorité) : effets sur les besoins, coût, récompense,
// délai entre deux utilisations. `where` = types d'intérieurs où l'activité est possible.
export const ACTIVITIES = {
  nap: { name: 'Sieste', where: ['house', 'hospital'], needs: { energie: 35, humeur: 4 }, cooldown: 60_000 },
  tv: { name: 'Télé', where: ['house'], needs: { humeur: 10, energie: -2 }, cooldown: 30_000 },
  movie: { name: 'Séance de cinéma', where: ['cinema'], cost: 8, needs: { humeur: 25 }, cooldown: 90_000 },
  gym: { name: 'Musculation', where: ['gym'], needs: { humeur: 8, energie: -12, faim: -8 }, xp: 4, cooldown: 25_000 },
  drink: { name: 'Fontaine à eau', where: ['office', 'school', 'hospital'], needs: { energie: 6, humeur: 1 }, cooldown: 30_000 },
  hospital: { name: 'Consultation', where: ['hospital'], needs: { energie: 30, humeur: 12, faim: 5 }, cooldown: 300_000 },
  arcade: { name: 'Borne d\'arcade', where: ['arcade'], cost: 1, needs: { humeur: 6 }, cooldown: 3_000, jackpot: 0.08, jackpotCoins: 15 },
  claw: { name: 'Pince à peluches', where: ['arcade'], cost: 2, needs: { humeur: 4 }, cooldown: 3_000, prize: 'peluche-poulet', prizeChance: 0.12 },
  bowling: { name: 'Bowling', where: ['bowling'], cost: 2, needs: { humeur: 10 }, cooldown: 6_000 },
  quiz: { name: 'Question du jour', where: ['school'], xp: 30, coins: 10, cooldown: 600_000 },
  chest: { name: 'Coffre mystérieux', where: ['cabin'], once: true, coins: 150, xp: 40 },
  mairie: { name: 'Réclamation absurde', where: ['mairie'], once: true, title: 'Râleur officiel', xp: 20 },
  pole: { name: 'Mât des pompiers', where: ['firestation'], needs: { humeur: 6 }, cooldown: 5_000 },
  sit: { name: 'S\'asseoir', where: null, needs: { energie: 2 }, cooldown: 20_000, quiet: true },
  mail: { name: 'Courrier', where: ['lobby'], cooldown: 60_000, needs: { humeur: 3 } },
  douche: { name: 'Douche', where: ['gym', 'hospital'], cost: 2, needs: { hygiene: 100, humeur: 3 }, cooldown: 30_000 },
};

// Questions du jour (école) : la bonne réponse est l'indice `a`.
export const QUIZ = [
  { q: 'Combien de pattes a un poulet en pyjama ?', c: ['2', '4', 'Ça dépend du pyjama'], a: 0 },
  { q: 'Quelle est la capitale de PLAYZONE ?', c: ['La Grande Place', 'Le Burger Absurde', 'Le pigeon'], a: 0 },
  { q: 'Que fait un pompier quand un chat est coincé ?', c: ['Il le sauve', 'Il lui lit un poème', 'Il appelle un autre chat'], a: 0 },
  { q: 'Combien font 7 croissants moins 7 croissants ?', c: ['Des miettes', '14', '0'], a: 2 },
  { q: 'Quel animal dit "Coin !" ?', c: ['Le canard', 'Le cochon', 'Le banquier'], a: 0 },
  { q: 'Que veut dire "PC" à PLAYZONE ?', c: ['PlayCoins', 'Poulet Croustillant', 'Pas Content'], a: 0 },
  { q: 'Où trouve-t-on des voitures neuves ?', c: ['Auto Paillettes', 'Bric à Broc', 'La boulangerie'], a: 0 },
  { q: 'Quelle couleur fait vert + rouge au feu tricolore ?', c: ['Orange (on ralentit)', 'Bleu', 'Pizza'], a: 0 },
];
export function quizOfDay(now) { return QUIZ[Math.floor(now / 600_000) % QUIZ.length]; }
