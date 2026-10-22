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
  'moniteur': { name: 'Brevet de moniteur·rice d\'auto-école', cost: 1400, minutes: 8, where: 'school', pass: 3, questions: [
    ['Un élève cale au feu vert. Vous...', ['Restez calme et expliquez.', 'Criez.', 'Sortez de la voiture.'], 0],
    ['Le rétroviseur sert à...', ['Voir derrière.', 'Se coiffer.', 'Rien.'], 0],
    ['Avant de changer de file, on...', ['Met son clignotant et regarde.', 'Klaxonne.', 'Ferme les yeux.'], 0],
    ['Un élève va trop vite. Vous...', ['Utilisez la double pédale.', 'Applaudissez.', 'Dormez.'], 0],
  ] },
  'croupier': { name: 'École de croupier·ère', cost: 1600, minutes: 8, where: 'school', pass: 3, questions: [
    ['À la roulette, combien de cases ?', ['37 (0 à 36)', '12', '100'], 0],
    ['Un joueur triche. Vous...', ['Appelez la sécurité.', 'Trichez aussi.', 'Partez.'], 0],
    ['Le blackjack se joue jusqu\'à...', ['21', '42', '7'], 0],
    ['Un croupier doit être...', ['Calme et honnête.', 'Bavard et distrait.', 'Absent.'], 0],
  ] },
  'moniteur-sport': { name: 'Brevet de moniteur·rice de sports (ski, surf, jet ski)', cost: 2000, minutes: 10, where: 'school', pass: 4, questions: [
    ['Avant une sortie en mer, on vérifie...', ['La météo et le vent.', 'Son horoscope.', 'Rien.'], 0],
    ['Sur les pistes, priorité à...', ['Celui qui est en aval (devant).', 'Le plus rapide.', 'Personne.'], 0],
    ['Un débutant a peur. Vous...', ['Le rassurez et allez doucement.', 'Le poussez.', 'Riez.'], 0],
    ['Le gilet de sauvetage, c\'est...', ['Obligatoire en jet ski.', 'Pour faire joli.', 'Interdit.'], 0],
    ['Une piste noire, c\'est...', ['Très difficile.', 'Pour les enfants.', 'Fermée la nuit seulement.'], 0],
  ] },
  'ingenieur': { name: 'Diplôme d\'ingénieur·e (mécanique et course)', cost: 5000, minutes: 15, where: 'school', pass: 4, questions: [
    ['Plus d\'appui aérodynamique, c\'est...', ['Plus d\'adhérence en virage.', 'Plus de café.', 'Moins de roues.'], 0],
    ['Des pneus froids...', ['Accrochent moins.', 'Accrochent plus.', 'Chantent.'], 0],
    ['Un arrêt aux stands sert à...', ['Changer les pneus.', 'Pique-niquer.', 'Laver le pilote.'], 0],
    ['Les données de télémétrie aident à...', ['Régler la voiture.', 'Faire la cuisine.', 'Rien.'], 0],
    ['La sécurité passe...', ['Avant tout.', 'Après la vitesse.', 'Jamais.'], 0],
  ] },
  'coiffure': { name: 'CAP Coiffure', cost: 700, minutes: 6, where: 'school', pass: 3, questions: [
    ['Avant une coupe, on...', ['Demande ce que veut le client.', 'Rase tout.', 'Ferme les yeux.'], 0],
    ['Des ciseaux, ça se...', ['Désinfecte.', 'Mange.', 'Jette.'], 0],
    ['Un dégradé, c\'est...', ['Une coupe progressive.', 'Une couleur de mur.', 'Un plat.'], 0],
    ['Le client n\'aime pas sa coupe. Vous...', ['Proposez une retouche.', 'Riez.', 'Partez.'], 0],
  ] },
  'architecte': { name: 'École d\'architecture', cost: 6500, minutes: 16, where: 'school', pass: 4, questions: [
    ['Un plan de maison montre...', ['Les pièces et les murs.', 'La météo.', 'Le menu.'], 0],
    ['Une fondation sert à...', ['Porter la maison.', 'Décorer.', 'Rien.'], 0],
    ['Une baie vitrée apporte...', ['De la lumière.', 'Des pigeons.', 'De la pluie.'], 0],
    ['Avant de construire, il faut...', ['Un permis de construire.', 'Un permis de pêche.', 'Rien.'], 0],
    ['Bien isoler une maison...', ['Économise du chauffage.', 'La fait fondre.', 'Ne sert à rien.'], 0],
  ] },
  'droit': { name: 'Faculté de droit (avocat·e)', cost: 9000, minutes: 20, where: 'school', pass: 5, questions: [
    ['Toute personne est présumée...', ['Innocente.', 'Coupable.', 'Pigeon.'], 0],
    ['Un avocat défend...', ['Son client.', 'Le juge.', 'Le pigeon.'], 0],
    ['Le tribunal juge...', ['Les délits.', 'Les recettes.', 'Les chansons.'], 0],
    ['Un contrat doit être...', ['Signé par les deux parties.', 'Écrit au crayon.', 'Secret.'], 0],
    ['On a droit à...', ['Un avocat.', 'Un dessert.', 'Rien.'], 0],
    ['Une amende, c\'est...', ['Une sanction en argent.', 'Un fruit.', 'Un cadeau.'], 0],
  ] },
  'pharma': { name: 'Diplôme de préparateur·rice en pharmacie', cost: 2200, minutes: 10, where: 'school', pass: 4, questions: [
    ['Un médicament se prend...', ['Selon l\'ordonnance.', 'Au hasard.', 'Avec du ketchup.'], 0],
    ['Un pansement protège...', ['Une plaie.', 'Un téléphone.', 'Une voiture.'], 0],
    ['La date de péremption...', ['Se vérifie.', 'Ne compte pas.', 'Se mange.'], 0],
    ['Un client a de la fièvre. Vous conseillez...', ['Repos et avis médical si ça dure.', 'Un marathon.', 'Rien.'], 0],
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
  // ---- nouveaux métiers (grande carte)
  { id: 'vendeur-auto', name: 'Vendeur·se automobile', where: ['showroom'], wage: 175, hard: 2, needs: 'cap-vente', tasks: ['Faire essayer une voiture', 'Négocier une reprise', 'Lustrer une carrosserie'] },
  { id: 'vendeur-luxe', name: 'Conseiller·ère de vente de luxe', where: ['concession-luxe', 'luxe', 'bijouterie'], wage: 260, hard: 2, needs: 'commerce', tasks: ['Accueillir un client VIP', 'Présenter une supercar', 'Servir le champagne (sans alcool)'] },
  { id: 'moniteur-auto', name: 'Moniteur·rice d\'auto-école', where: ['auto-ecole'], wage: 210, hard: 3, needs: 'moniteur', tasks: ['Donner une leçon de conduite', 'Corriger un créneau', 'Préparer un élève au code'] },
  { id: 'conseiller-emploi', name: 'Conseiller·ère Pôle emploi', where: ['pole-emploi'], wage: 180, hard: 2, needs: 'commerce', tasks: ['Recevoir un demandeur d\'emploi', 'Mettre à jour les offres', 'Relire un CV'] },
  { id: 'armurier', name: 'Armurier·ère (tir sportif)', where: ['armurerie', 'stand-tir'], wage: 160, hard: 2, needs: 'cap-vente', tasks: ['Contrôler une licence', 'Nettoyer le matériel', 'Conseiller un tireur'] },
  { id: 'vendeur-tech', name: 'Vendeur·se high-tech', where: ['hightech', 'pixel'], wage: 150, hard: 2, needs: 'cap-vente', tasks: ['Démontrer une console', 'Configurer un téléphone', 'Ranger les câbles'] },
  { id: 'technicien-info', name: 'Technicien·ne informatique', where: ['hightech', 'tour'], wage: 240, hard: 3, needs: 'code', tasks: ['Réparer un ordinateur', 'Installer un réseau', 'Récupérer des données'] },
  { id: 'croupier', name: 'Croupier·ère', where: ['casino'], wage: 220, hard: 3, needs: 'croupier', tasks: ['Lancer la roulette', 'Distribuer les cartes', 'Compter les jetons'] },
  { id: 'securite', name: 'Agent·e de sécurité', where: ['casino', 'hightech', 'concession-luxe', 'office'], wage: 150, hard: 3, needs: null, tasks: ['Faire une ronde', 'Contrôler une entrée', 'Surveiller les caméras'] },
  { id: 'moniteur-glisse', name: 'Moniteur·rice de surf, wingfoil et jet ski', where: ['surf-shop'], wage: 175, hard: 3, needs: 'moniteur-sport', tasks: ['Donner un cours de wingfoil', 'Vérifier les gilets', 'Réparer une aile'] },
  { id: 'entraineur-foot', name: 'Entraîneur·se de foot', where: ['club-foot'], wage: 190, hard: 3, needs: 'coach', tasks: ['Préparer un entraînement', 'Motiver l\'équipe', 'Analyser un match'] },
  { id: 'ingenieur-f1', name: 'Ingénieur·e de course F1', where: ['f1-paddock'], wage: 380, hard: 4, needs: 'ingenieur', tasks: ['Régler l\'aileron', 'Analyser la télémétrie', 'Préparer un arrêt au stand'] },
  { id: 'mecano-f1', name: 'Mécanicien·ne de stand F1', where: ['f1-paddock'], wage: 230, hard: 4, needs: 'cap-meca', tasks: ['Changer 4 pneus en 3 secondes', 'Nettoyer le garage', 'Chauffer les pneus'] },
  { id: 'agriculteur', name: 'Agriculteur·rice / vigneron·ne', where: ['barn'], wage: 120, hard: 4, needs: null, tasks: ['Récolter les raisins', 'Nourrir les animaux', 'Réparer une clôture'] },
  { id: 'chauffeur-bus', name: 'Chauffeur·se de bus', where: ['depot-bus'], wage: 150, hard: 3, needs: null, tasks: ['Vérifier le bus', 'Faire le plein', 'Nettoyer les sièges'] },
  { id: 'gardien-prison', name: 'Surveillant·e pénitentiaire', where: ['prison'], wage: 210, hard: 4, needs: 'police', tasks: ['Faire l\'appel', 'Surveiller la cour', 'Fouiller une cellule'] },
  { id: 'coiffeur', name: 'Coiffeur·se', where: ['salon'], wage: 140, hard: 2, needs: 'coiffure', tasks: ['Faire un shampooing', 'Couper une frange', 'Balayer les cheveux'] },
  { id: 'boulanger', name: 'Boulanger·ère', where: ['bakery'], wage: 145, hard: 3, needs: 'cap-cuisine', tasks: ['Pétrir la pâte', 'Cuire les baguettes', 'Servir les croissants'] },
  { id: 'barman', name: 'Barman / barmaid', where: ['cafe'], wage: 115, hard: 2, needs: null, tasks: ['Préparer un café', 'Faire un smoothie', 'Essuyer le comptoir'] },
  { id: 'projectionniste', name: 'Projectionniste', where: ['cinema'], wage: 120, hard: 1, needs: null, tasks: ['Lancer le film', 'Vendre du pop-corn', 'Nettoyer la salle'] },
  { id: 'animateur', name: 'Animateur·rice de loisirs', where: ['bowling', 'arcade'], wage: 115, hard: 2, needs: null, tasks: ['Réparer une quille', 'Organiser un tournoi', 'Rendre la monnaie'] },
  { id: 'architecte', name: 'Architecte', where: ['agency', 'office'], wage: 340, hard: 3, needs: 'architecte', tasks: ['Dessiner un plan', 'Visiter un chantier', 'Rencontrer un client'] },
  { id: 'avocat', name: 'Avocat·e', where: ['mairie', 'police', 'office'], wage: 420, hard: 4, needs: 'droit', tasks: ['Défendre un client', 'Préparer une plaidoirie', 'Lire un dossier'] },
  { id: 'pharmacien', name: 'Préparateur·rice en pharmacie', where: ['pharmacie'], wage: 190, hard: 2, needs: 'pharma', tasks: ['Préparer une ordonnance', 'Conseiller un client', 'Ranger les médicaments'] },
  { id: 'vendeur-maison', name: 'Vendeur·se en magasin', where: ['maison-deco', 'bricolage', 'jardinerie', 'sport-shop'], wage: 130, hard: 2, needs: null, tasks: ['Conseiller un client', 'Monter un meuble d\'exposition', 'Réassort des rayons'] },
  { id: 'professeur-campus', name: 'Formateur·rice au Campus', where: ['campus'], wage: 230, hard: 3, needs: 'enseignant', tasks: ['Donner un cours', 'Faire passer un examen', 'Corriger des copies'] },
];
export const JOB_BY_ID2 = Object.fromEntries(JOBS.map((j) => [j.id, j]));

// Paie par minute réelle (au prorata du salaire horaire de jeu), avec bonus d'ancienneté / augmentations.
export const wagePerMinute = (job, raise = 0) => (job.wage * (1 + raise)) / (GAME_HOUR_MS / 60_000);
export const MAX_RAISE = 0.6;          // +60 % au maximum
export const RAISE_STEP = 0.1;         // +10 % par augmentation accordée
export const RAISE_WORK_MIN = 20;      // minutes travaillées depuis la dernière demande
