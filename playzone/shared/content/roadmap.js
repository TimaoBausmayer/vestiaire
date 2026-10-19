// Calendrier prévisionnel des mises à jour (affiché dans l'appli "Saison" du téléphone et le README).
// Alternance : une grosse mise à jour de saison, puis une petite mise à jour de contenu le mois suivant.
// status : 'live' (disponible), 'prevu' (planifié, PAS encore développé).
export const ROADMAP = [
  { month: '2026-10', kind: 'saison', title: 'Halloween à PLAYZONE', status: 'live', items: ['Chasse aux citrouilles (événement)', 'Tête de citrouille, chapeau de sorcière, cape de vampire', 'Citrouilles lanternes et canapé cercueil', 'Décorations de la ville'] },
  { month: '2026-11', kind: 'petite', title: 'Automne gourmand', status: 'prevu', items: ['Métier Fermier (récoltes, animaux de la ferme)', 'Mini-jeu : Course de caddies', 'Nouvelles recettes au Burger Absurde', 'Corrections et équilibrage'] },
  { month: '2026-12', kind: 'saison', title: 'Hiver : neige et marché de Noël', status: 'prevu', items: ['Neige sur la ville, patinoire sur la Grande Place', 'Marché de Noël (stands, cadeaux)', 'Événement : Bataille de boules de neige', 'Pulls moches et bonnets de lutin'] },
  { month: '2027-01', kind: 'petite', title: 'Nouvel an et entreprises', status: 'prevu', items: ['Métier Entrepreneur : ouvrir sa boutique', 'Mini-jeu : Sumo sur plateformes', 'Groupes de joueurs (guildes)'] },
  { month: '2027-02', kind: 'petite', title: 'Carnaval', status: 'prevu', items: ['Parade d\'animaux (événement)', 'Costumes de carnaval', 'Mini-jeu : Chaises musicales'] },
  { month: '2027-03', kind: 'saison', title: 'Printemps : ferme et jardinage', status: 'prevu', items: ['Jardin dans son logement', 'Concours d\'animaux', 'Métiers Vétérinaire et Fleuriste'] },
  { month: '2027-04', kind: 'petite', title: 'Chasse aux œufs', status: 'prevu', items: ['Chasse au trésor géante', 'Métier Photographe (missions photo)'] },
  { month: '2027-06', kind: 'saison', title: 'Été : plage, surf et courses nautiques', status: 'prevu', items: ['Surf et jet-ski', 'Fêtes sur la plage', 'Métiers Pêcheur et Maître-nageur', 'Courses nautiques'] },
];
