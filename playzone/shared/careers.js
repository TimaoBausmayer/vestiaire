// CARRIÈRES : emplois salariés (payés à l'heure de jeu travaillée), formations payantes chronométrées
// terminées par un examen, augmentations, licenciement. Plus c'est dur, plus ça paie.
// Échelle de temps : 10 minutes réelles = 1 heure de jeu. Salaire indiqué = PC par heure de jeu.

export const GAME_HOUR_MS = 10 * 60_000;

// Formations : coût, durée (minutes réelles de présence à l'école ou en ligne), examen (QCM).
export const TRAININGS = {
  'cap-vente': { name: 'Formation Vente & Sourire', cost: 300, minutes: 4, where: 'school', pass: 3, questions: [
    ['Un client entre. Que dites-vous ?', ['« Bonjour, je peux vous aider ? »', '« Encore un... »', 'Rien, je finis mon sandwich.'], 0],
    ['Le client veut rendre un pull porté trois ans. Vous...', ['Lui jetez le pull.', 'Appliquez poliment la politique de retour.', 'Pleurez.'], 1],
    ['Le meilleur argument de vente ?', ['Le mensonge.', 'Écouter le besoin du client.', 'Crier plus fort que lui.'], 1],
    ['Un rayon est en désordre. Vous...', ['Le rangez.', 'Accusez le pigeon.', 'Changez de rayon.'], 0],
  ] },
  'cap-cuisine': { name: 'CAP Cuisine (sans brûler la cuisine)', cost: 600, minutes: 6, where: 'school', pass: 3, questions: [
    ['À quelle température cuit un steak saignant (à cœur) ?', ['Environ 50 °C', '200 °C', '-4 °C'], 0],
    ['On se lave les mains...', ['Une fois par an.', 'Avant de cuisiner et souvent.', 'Seulement le dimanche.'], 1],
    ['Que met-on dans une omelette ?', ['Des œufs.', 'Des chaussettes.', 'Du ciment.'], 0],
    ['Une poêle prend feu. Vous...', ['Jetez de l\'eau.', 'Couvrez avec un couvercle.', 'Soufflez très fort.'], 1],
  ] },
  'cap-meca': { name: 'CAP Mécanique (Piston Fou)', cost: 900, minutes: 7, where: 'school', pass: 3, questions: [
    ['Le voyant d\'huile s\'allume. Vous...', ['Ajoutez de l\'huile.', 'Mettez de la confiture.', 'Ignorez, c\'est joli.'], 0],
    ['Quel outil pour un écrou ?', ['Une clé.', 'Une cuillère.', 'Un poulet.'], 0],
    ['Des pneus lisses, c\'est...', ['Plus rapide.', 'Dangereux : à changer.', 'À la mode.'], 1],
    ['La batterie est à plat. On peut...', ['La recharger ou la remplacer.', 'La gonfler.', 'L\'arroser.'], 0],
  ] },
  'pompier': { name: 'École des pompiers', cost: 800, minutes: 6, where: 'school', pass: 3, questions: [
    ['Le numéro des pompiers en France ?', ['18', '42', '007'], 0],
    ['Feu d\'huile : on utilise...', ['De l\'eau.', 'Un extincteur adapté ou une couverture.', 'Un ventilateur.'], 1],
    ['Un chat est coincé dans un arbre. Priorité ?', ['Le rassurer et le descendre en sécurité.', 'Secouer l\'arbre.', 'Appeler un autre chat.'], 0],
    ['Avant d\'entrer dans une pièce enfumée...', ['On vérifie et on s\'équipe.', 'On fonce.', 'On ouvre grand pour voir.'], 0],
  ] },
  'police': { name: 'École de police', cost: 1200, minutes: 8, where: 'school', pass: 4, questions: [
    ['Un feu rouge veut dire...', ['Accélérer.', 'S\'arrêter.', 'Klaxonner.'], 1],
    ['Lors d\'une interpellation, on reste...', ['Calme et poli.', 'Énervé.', 'Caché.'], 0],
    ['La vitesse en ville est souvent limitée à...', ['50 km/h', '130 km/h', '5 km/h'], 0],
    ['Un témoin peut...', ['Aider l\'enquête.', 'Être arrêté sans raison.', 'Être ignoré.'], 0],
    ['Le vol d\'une voiture, c\'est...', ['Un délit.', 'Un emprunt.', 'Un sport.'], 0],
  ] },
  'infirmier': { name: 'Diplôme d\'infirmier·ère', cost: 2500, minutes: 12, where: 'school', pass: 4, questions: [
    ['Une plaie qui saigne : on commence par...', ['Comprimer.', 'Souffler dessus.', 'Prendre une photo.'], 0],
    ['La température normale du corps ?', ['37 °C', '45 °C', '20 °C'], 0],
    ['Avant un soin, on...', ['Se lave les mains.', 'Mange un croissant.', 'Court.'], 0],
    ['Une personne ne respire plus : on appelle...', ['Les secours (15 / 112).', 'Sa mamie.', 'Personne.'], 0],
    ['Le sommeil, c\'est...', ['Indispensable à la santé.', 'Optionnel.', 'Pour les faibles.'], 0],
  ] },
  'commerce': { name: 'Formation Commerce & Immobilier', cost: 1500, minutes: 8, where: 'school', pass: 3, questions: [
    ['Un crédit immobilier, c\'est...', ['Un prêt pour acheter un logement.', 'Un cadeau.', 'Un jeu.'], 0],
    ['Le loyer se paie...', ['Régulièrement.', 'Jamais.', 'En bonbons.'], 0],
    ['Une maison en bord de mer coûte souvent...', ['Plus cher.', 'Moins cher.', 'Rien.'], 0],
    ['Un bon contrat est...', ['Lu avant d\'être signé.', 'Signé les yeux fermés.', 'Mangé.'], 0],
  ] },
  'code': { name: 'Formation Développeur·se', cost: 3000, minutes: 12, where: 'school', pass: 4, questions: [
    ['Un bug, c\'est...', ['Une erreur dans un programme.', 'Un insecte de compagnie.', 'Une marque de soda.'], 0],
    ['Pour ne rien perdre, on fait...', ['Des sauvegardes.', 'Des prières.', 'Rien.'], 0],
    ['Un mot de passe sûr est...', ['Long et unique.', '« 1234 ».', 'Son prénom.'], 0],
    ['Avant de livrer, on...', ['Teste.', 'Croise les doigts.', 'Part en vacances.'], 0],
    ['HTML sert à...', ['Structurer une page web.', 'Cuire des pâtes.', 'Réparer un vélo.'], 0],
  ] },
  'finance': { name: 'Master Finance (Banque PlayCoins)', cost: 6000, minutes: 16, where: 'school', pass: 4, questions: [
    ['Diversifier ses placements permet de...', ['Réduire le risque.', 'Tout perdre plus vite.', 'Rien.'], 0],
    ['Des intérêts, c\'est...', ['Le prix de l\'argent prêté.', 'Une passion.', 'Un impôt sur les pigeons.'], 0],
    ['Une action peut...', ['Monter ou baisser.', 'Seulement monter.', 'Voler.'], 0],
    ['Un budget sert à...', ['Prévoir ses dépenses.', 'Décorer.', 'Rien.'], 0],
    ['Faillite veut dire...', ['Ne plus pouvoir payer ses dettes.', 'Faire la fête.', 'Gagner.'], 0],
  ] },
  'medecine': { name: 'Études de médecine', cost: 12000, minutes: 25, where: 'school', pass: 5, questions: [
    ['Le cœur sert à...', ['Pomper le sang.', 'Digérer.', 'Penser.'], 0],
    ['Un antibiotique soigne...', ['Les infections bactériennes.', 'Les virus du rhume.', 'La tristesse.'], 0],
    ['La fracture, c\'est...', ['Un os cassé.', 'Une facture.', 'Une fraction.'], 0],
    ['Pour bien dormir, on évite...', ['Les écrans tard le soir.', 'Le lit.', 'L\'oreiller.'], 0],
    ['Combien de poumons a un humain ?', ['2', '1', '4'], 0],
    ['On garde le secret médical...', ['Toujours.', 'Jamais.', 'Le mardi.'], 0],
  ] },
  'coach': { name: 'Diplôme de coach sportif', cost: 1000, minutes: 7, where: 'school', pass: 3, questions: [
    ['Avant le sport, on...', ['S\'échauffe.', 'Mange un menu géant.', 'Dort.'], 0],
    ['Boire de l\'eau pendant l\'effort, c\'est...', ['Important.', 'Interdit.', 'Inutile.'], 0],
    ['Les muscles grossissent surtout...', ['Au repos, après l\'effort.', 'En regardant la télé.', 'Jamais.'], 0],
    ['Une pompe travaille...', ['Les bras et le torse.', 'Les oreilles.', 'Les orteils.'], 0],
  ] },
  'enseignant': { name: 'Formation d\'enseignant·e', cost: 1800, minutes: 10, where: 'school', pass: 4, questions: [
    ['Un élève ne comprend pas. Vous...', ['Réexpliquez autrement.', 'Criez.', 'Partez.'], 0],
    ['2 + 2 × 3 = ?', ['8', '12', '7'], 0],
    ['La capitale de la France ?', ['Paris', 'PLAYZONE', 'Marseille'], 0],
    ['Corriger les copies, c\'est...', ['Le travail.', 'Facultatif.', 'Le travail du chat.'], 0],
    ['Le pluriel de « cheval » ?', ['Chevaux', 'Chevals', 'Chevalles'], 0],
  ] },
};

// Emplois : lieu de travail (type d'intérieur ou id de bâtiment), salaire par heure de jeu, formation requise,
// pénibilité (1 facile → 5 très dur), tâches proposées pendant le service.
export const JOBS = [
  { id: 'caissier', name: 'Caissier·ère', where: ['supermarket'], wage: 95, hard: 1, needs: null, tasks: ['Scanner les articles', 'Encaisser un client', 'Ranger un rayon'] },
  { id: 'serveur', name: 'Serveur·se', where: ['restaurant', 'cafe', 'fastfood'], wage: 105, hard: 2, needs: null, tasks: ['Prendre une commande', 'Servir une table', 'Débarrasser'] },
  { id: 'entretien', name: 'Agent·e d\'entretien', where: ['office', 'hospital', 'school'], wage: 95, hard: 2, needs: null, tasks: ['Passer la serpillière', 'Vider les poubelles', 'Nettoyer les vitres'] },
  { id: 'magasinier', name: 'Magasinier·ère', where: ['warehouse', 'factory'], wage: 115, hard: 3, needs: null, tasks: ['Charger un camion', 'Empiler des cartons', 'Inventaire'] },
  { id: 'vendeur', name: 'Vendeur·se', where: ['shop'], wage: 125, hard: 2, needs: 'cap-vente', tasks: ['Conseiller un client', 'Plier les vêtements', 'Encaisser'] },
  { id: 'cuisinier-resto', name: 'Cuisinier·ère', where: ['restaurant', 'fastfood'], wage: 160, hard: 3, needs: 'cap-cuisine', tasks: ['Préparer un plat', 'Surveiller la cuisson', 'Dresser l\'assiette'] },
  { id: 'mecanicien', name: 'Mécanicien·ne', where: ['workshop'], wage: 175, hard: 4, needs: 'cap-meca', tasks: ['Changer une roue', 'Vidanger', 'Réparer une portière'] },
  { id: 'pompier-pro', name: 'Pompier·ère professionnel·le', where: ['firestation'], wage: 190, hard: 5, needs: 'pompier', tasks: ['Vérifier le camion', 'Entraînement au mât', 'Intervention'] },
  { id: 'policier', name: 'Policier·ère', where: ['police'], wage: 200, hard: 5, needs: 'police', tasks: ['Rédiger un rapport', 'Accueillir une plainte', 'Patrouille'] },
  { id: 'agent-immo', name: 'Agent·e immobilier·ère', where: ['agency'], wage: 185, hard: 3, needs: 'commerce', tasks: ['Faire visiter', 'Rédiger une annonce', 'Négocier un prix'] },
  { id: 'coach', name: 'Coach sportif', where: ['gym'], wage: 165, hard: 4, needs: 'coach', tasks: ['Motiver un client', 'Corriger une posture', 'Nettoyer les machines'] },
  { id: 'prof', name: 'Professeur·e', where: ['school'], wage: 195, hard: 4, needs: 'enseignant', tasks: ['Donner un cours', 'Corriger des copies', 'Surveiller la récré'] },
  { id: 'infirmier', name: 'Infirmier·ère', where: ['hospital'], wage: 230, hard: 5, needs: 'infirmier', tasks: ['Faire un pansement', 'Prendre la tension', 'Rassurer un patient'] },
  { id: 'developpeur', name: 'Développeur·se', where: ['office'], wage: 290, hard: 4, needs: 'code', tasks: ['Corriger un bug', 'Écrire des tests', 'Réunion (aïe)'] },
  { id: 'banquier', name: 'Banquier·ère', where: ['bank'], wage: 320, hard: 4, needs: 'finance', tasks: ['Conseiller un client', 'Étudier un crédit', 'Compter les billets'] },
  { id: 'medecin', name: 'Médecin', where: ['hospital'], wage: 450, hard: 5, needs: 'medecine', tasks: ['Consultation', 'Diagnostic', 'Ordonnance'] },
];
export const JOB_BY_ID2 = Object.fromEntries(JOBS.map((j) => [j.id, j]));

// Paie par minute réelle (au prorata du salaire horaire de jeu), avec bonus d'ancienneté / augmentations.
export const wagePerMinute = (job, raise = 0) => (job.wage * (1 + raise)) / (GAME_HOUR_MS / 60_000);
export const MAX_RAISE = 0.6;          // +60 % au maximum
export const RAISE_STEP = 0.1;         // +10 % par augmentation accordée
export const RAISE_WORK_MIN = 20;      // minutes travaillées depuis la dernière demande
