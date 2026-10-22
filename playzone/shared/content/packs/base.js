// Pack de contenu de base de PLAYZONE (version 0.1). Les packs suivants (saisons, mises à jour)
// ajoutent des objets, missions, mini-jeux et événements au même format : voir registry.js.
import { VEHICLES } from '../vehicles.js';

// Véhicules neufs vendus à la concession Auto Paillettes (voitures) et chez Deux-Roues Express (vélo, moto) (le prix et le niveau viennent du catalogue des véhicules).
const NEW_CARS = [
  ['velo', '🚲', 'Écologique, silencieux, parfait pour doubler les escargots.'],
  ['moto', '🏍️', 'Pour arriver avant tout le monde (et décoiffé).'],
  ['citadine', '🚗', 'Se gare partout, même là où il ne faut pas.'],
  ['berline', '🚘', 'Confortable. Le siège passager est réservé à votre ego.'],
  ['break', '🚙', 'Un coffre assez grand pour un canapé et deux poulets.'],
  ['fourgon', '🚐', 'Idéal pour déménager... ou faire semblant d\'être livreur.'],
  ['pickup', '🛻', 'La benne est fournie avec un mystérieux carton.'],
  ['suv', '🚙', 'Monte sur les trottoirs (ne le faites pas).'],
  ['camion', '🚚', 'Il klaxonne comme un paquebot.'],
  ['coupe', '🏎️', 'Deux portes, zéro place pour vos courses.'],
  ['sportive', '🏎️', 'Accélère plus vite que vos économies ne disparaissent.'],
  // Prestige Motors (concession de luxe)
  ['volt-plaid', '⚡', 'Électrique, silencieuse, 0 à 100 avant d\'avoir fini d\'éternuer.'],
  ['gt-velours', '🏎️', 'Sièges en velours, klaxon en harpe.'],
  ['suv-taureau', '🚙', 'Un 4x4 qui ne monte jamais sur un chemin. Trop beau pour ça.'],
  ['fantome', '🎩', 'Le chauffeur n\'est pas fourni. La classe, si.'],
  ['furioso', '🐂', 'V12, portes en ciseaux, voisins jaloux.'],
  ['chiron-mamie', '👵', 'La voiture la plus rapide de PLAYZONE. Mamie l\'a validée.'],
].map(([id, emoji, desc]) => ({ id, name: VEHICLES[id].name, shop: id === 'velo' || id === 'moto' ? 'bikes' : VEHICLES[id].price >= 100000 ? 'cars-luxe' : 'cars-new', vehicle: id, price: VEHICLES[id].price, level: VEHICLES[id].level, emoji, desc, max: 1 }));

export default {
  id: 'base',
  name: 'PLAYZONE — Lancement',
  version: '0.1.0',
  items: [
    // ---------- Vêtements (Fringues & Frites)
    { id: 'casquette', name: 'Casquette Rouge Vif', shop: 'clothes', slot: 'hat', price: 60, emoji: '🧢', desc: 'Pour avoir l\'air pressé même quand on ne fait rien.' },
    { id: 'bonnet', name: 'Bonnet à Pompon', shop: 'clothes', slot: 'hat', price: 80, emoji: '🧶', desc: 'Le pompon amortit 3 % des chocs de la vie.' },
    { id: 'paille', name: 'Chapeau de Paille', shop: 'clothes', slot: 'hat', price: 90, emoji: '👒', desc: 'Les vaches le trouvent appétissant. Méfiance.' },
    { id: 'bandeau', name: 'Bandeau de Sport', shop: 'clothes', slot: 'hat', price: 50, emoji: '🎽', desc: 'Augmente la motivation, pas la vitesse.' },
    { id: 'cowboy', name: 'Chapeau de Cow-boy', shop: 'clothes', slot: 'hat', price: 220, emoji: '🤠', desc: 'Il n\'y a pas de chevaux en ville. Si, à la ferme.' },
    { id: 'oreilles-lapin', name: 'Oreilles de Lapin', shop: 'clothes', slot: 'hat', price: 260, emoji: '🐰', desc: 'Les lapins vous trouveront suspect.' },
    { id: 'sombrero', name: 'Sombrero Géant', shop: 'clothes', slot: 'hat', price: 300, emoji: '🪅', desc: 'Fait de l\'ombre à tout le quartier.' },
    { id: 'haut-de-forme', name: 'Haut-de-forme', shop: 'clothes', slot: 'hat', price: 350, level: 3, emoji: '🎩', desc: 'Vous donne +12 de classe (statistique imaginaire).' },
    { id: 'hélice', name: 'Casquette à Hélice', shop: 'clothes', slot: 'hat', price: 400, level: 4, emoji: '🚁', desc: 'Ne permet pas de voler. On a vérifié.' },
    { id: 'couronne', name: 'Couronne du Quartier', shop: 'clothes', slot: 'hat', price: 5000, level: 10, rep: 200, emoji: '👑', desc: 'Réservée aux légendes de PLAYZONE.' },
    { id: 'lunettes-rondes', name: 'Lunettes Rondes', shop: 'clothes', slot: 'glasses', price: 70, emoji: '👓', desc: '+10 d\'intelligence apparente.' },
    { id: 'lunettes-soleil', name: 'Lunettes de Soleil', shop: 'clothes', slot: 'glasses', price: 120, emoji: '🕶️', desc: 'Même la nuit. Surtout la nuit.' },
    { id: 'lunettes-coeur', name: 'Lunettes Cœur', shop: 'clothes', slot: 'glasses', price: 180, emoji: '😍', desc: 'Tout le monde a l\'air plus sympa.' },
    { id: 'masque-plongee', name: 'Masque de Plongée', shop: 'clothes', slot: 'glasses', price: 150, emoji: '🤿', desc: 'Les requins respectent ce look.' },
    { id: 'moustache', name: 'Moustache Distinguée', shop: 'clothes', slot: 'glasses', price: 100, emoji: '🥸', desc: 'Fausse. Mais très convaincante.' },
    { id: 'monocle', name: 'Monocle en Or', shop: 'clothes', slot: 'glasses', price: 450, level: 5, emoji: '🧐', desc: 'Pour juger les gens avec un seul œil.' },
    { id: 'chemise', name: 'Chemise Sérieuse', shop: 'clothes', slot: 'top', price: 120, emoji: '👔', desc: 'Idéale pour les entretiens d\'embauche chez les pigeons.' },
    { id: 'raye', name: 'Marinière', shop: 'clothes', slot: 'top', price: 110, emoji: '⛵', desc: 'Obligatoire au port, selon le capitaine.' },
    { id: 'hawai', name: 'Chemise Hawaïenne', shop: 'clothes', slot: 'top', price: 250, emoji: '🌺', desc: 'Les vacances, version tissu.' },
    { id: 'costume', name: 'Costume Chic', shop: 'clothes', slot: 'top', price: 900, level: 5, emoji: '🤵', desc: 'Cravate incluse. Dignité en option.' },
    { id: 'jupe', name: 'Jupe Plissée', shop: 'clothes', slot: 'bottom', price: 90, emoji: '👗', desc: 'Tourne très bien pendant les danses.' },
    { id: 'echarpe', name: 'Écharpe Rouge', shop: 'clothes', slot: 'back', price: 90, emoji: '🧣', desc: 'Même en été. C\'est un style.' },
    { id: 'sac-a-dos', name: 'Sac à Dos', shop: 'clothes', slot: 'back', price: 150, emoji: '🎒', desc: 'Contient un sandwich de 2019.' },
    { id: 'bouee', name: 'Bouée Canard', shop: 'clothes', slot: 'back', price: 200, emoji: '🛟', desc: 'Pour la plage... et pour le reste de la journée.' },
    { id: 'cape', name: 'Cape de Héros', shop: 'clothes', slot: 'back', price: 600, level: 4, emoji: '🦸', desc: 'Les pouvoirs ne sont pas fournis.' },
    { id: 'guitare', name: 'Guitare Dans le Dos', shop: 'clothes', slot: 'back', price: 750, level: 3, emoji: '🎸', desc: 'Vous ne savez pas en jouer. Personne ne le sait.' },
    { id: 'ailes', name: 'Ailes d\'Ange', shop: 'clothes', slot: 'back', price: 2500, level: 8, emoji: '🪽', desc: 'Purement décoratives, malheureusement.' },

    // ---------- Meubles (Meubles Mous)
    { id: 'canape', name: 'Canapé Moelleux', shop: 'furniture', furniture: true, price: 250, emoji: '🛋️', desc: 'On s\'y enfonce jusqu\'aux oreilles.' },
    { id: 'lit', name: 'Lit Double', shop: 'furniture', furniture: true, price: 300, emoji: '🛏️', desc: 'Pour les siestes stratégiques.' },
    { id: 'table', name: 'Table Basse', shop: 'furniture', furniture: true, price: 150, emoji: '🪵', desc: 'Basse, mais ambitieuse.' },
    { id: 'chaise', name: 'Chaise Bancale', shop: 'furniture', furniture: true, price: 60, emoji: '🪑', desc: 'Un pied plus court, gratuitement.' },
    { id: 'lampe', name: 'Lampe Champignon', shop: 'furniture', furniture: true, price: 80, emoji: '🍄', desc: 'Éclaire. Ne se mange pas.' },
    { id: 'plante', name: 'Plante Verte', shop: 'furniture', furniture: true, price: 50, emoji: '🪴', desc: 'Elle écoute vos problèmes.' },
    { id: 'tapis', name: 'Tapis Rond', shop: 'furniture', furniture: true, price: 120, emoji: '🟣', desc: 'Relie toute la pièce. Selon un philosophe.' },
    { id: 'tele', name: 'Télé Géante', shop: 'furniture', furniture: true, price: 450, emoji: '📺', desc: 'Ne diffuse que des documentaires sur les pigeons.' },
    { id: 'etagere', name: 'Bibliothèque', shop: 'furniture', furniture: true, price: 180, emoji: '📚', desc: 'Des livres que vous lirez un jour.' },
    { id: 'frigo', name: 'Frigo Bavard', shop: 'furniture', furniture: true, price: 350, emoji: '🧊', desc: 'Il commente ce que vous mangez.' },
    { id: 'nain-jardin', name: 'Nain de Jardin', shop: 'furniture', furniture: true, price: 70, emoji: '🧙', desc: 'Il vous regarde. Toujours.' },
    { id: 'aquarium', name: 'Aquarium', shop: 'furniture', furniture: true, price: 600, emoji: '🐠', desc: 'Contient un poisson nommé Gérard.' },
    { id: 'baignoire', name: 'Baignoire à Canards', shop: 'furniture', furniture: true, price: 500, emoji: '🛁', desc: 'Les canards sont inclus et très fiers.' },
    { id: 'boule-disco', name: 'Boule Disco', shop: 'furniture', furniture: true, price: 800, emoji: '🪩', desc: 'Transforme le salon en boîte de nuit.' },
    { id: 'borne-arcade', name: 'Borne d\'Arcade', shop: 'furniture', furniture: true, price: 1200, level: 4, emoji: '🕹️', desc: 'Record actuel : le chat.' },
    { id: 'statue-poulet', name: 'Statue de Poulet Doré', shop: 'furniture', furniture: true, price: 1500, level: 5, emoji: '🐔', desc: 'Hommage aux héros de l\'Invasion.' },
    { id: 'piano', name: 'Piano à Queue', shop: 'furniture', furniture: true, price: 2000, level: 6, emoji: '🎹', desc: 'Joue faux tout seul la nuit.' },
    { id: 'trone', name: 'Trône du Salon', shop: 'furniture', furniture: true, price: 4000, level: 9, emoji: '🪑', desc: 'Pour régner sur la télécommande.' },
    { id: 'agrandissement', name: 'Agrandir le logement', shop: 'furniture', price: 3000, level: 4, max: 1, emoji: '🏠', desc: 'Passe du studio à un grand appartement (plus de place pour les meubles).', special: 'home-upgrade' },

    // ---------- Animalerie Poil-Poil (adoption + accessoires)
    { id: 'pet-chien', name: 'Adopter un chien', shop: 'pets', pet: 'chien', price: 400, emoji: '🐕', desc: 'Fidèle, joyeux, mange vos chaussettes.' },
    { id: 'pet-chat', name: 'Adopter un chat', shop: 'pets', pet: 'chat', price: 400, emoji: '🐈', desc: 'Il vous adoptera peut-être en retour.' },
    { id: 'pet-lapin', name: 'Adopter un lapin', shop: 'pets', pet: 'lapin', price: 250, emoji: '🐇', desc: 'Saute partout, juge tout le monde.' },
    { id: 'pet-rat', name: 'Adopter un rat', shop: 'pets', pet: 'rat', price: 150, emoji: '🐀', desc: 'Très intelligent. Trop intelligent ?' },
    { id: 'pet-poulet', name: 'Adopter un poulet', shop: 'pets', pet: 'poulet', price: 120, emoji: '🐓', desc: 'Pour ne plus être une cible lors des invasions.' },
    { id: 'pet-canard', name: 'Adopter un canard', shop: 'pets', pet: 'canard', price: 200, emoji: '🦆', desc: 'Coin. (C\'est tout ce qu\'il dit.)' },
    { id: 'pet-tortue', name: 'Adopter une tortue', shop: 'pets', pet: 'tortue', price: 300, emoji: '🐢', desc: 'Vous suivra... à son rythme.' },
    { id: 'pet-cochon', name: 'Adopter un mini-cochon', shop: 'pets', pet: 'cochon', price: 600, level: 3, emoji: '🐖', desc: 'Mini. En théorie.' },
    { id: 'pet-corbeau', name: 'Adopter un corbeau', shop: 'pets', pet: 'corbeau', price: 500, level: 3, emoji: '🐦‍⬛', desc: 'Vous rapporte des capsules de bouteille.' },
    { id: 'pet-serpent', name: 'Adopter un serpent', shop: 'pets', pet: 'serpent', price: 700, level: 4, emoji: '🐍', desc: 'Câlin, mais sans bras.' },
    { id: 'croquettes', name: 'Croquettes (x1)', shop: 'pets', consumable: true, price: 15, emoji: '🥣', desc: 'Nourrit un animal (+40 satiété).' },
    { id: 'friandise', name: 'Friandise (x1)', shop: 'pets', consumable: true, price: 25, emoji: '🦴', desc: 'Indispensable pour le dressage.' },

    // ---------- Garage Roule-Toujours
    { id: 'trottinette', name: 'Trottinette', shop: 'vehicles', vehicle: 'trottinette', price: 600, emoji: '🛴', desc: 'Silencieuse. Les pigeons ne vous entendent pas arriver.', max: 1 },
    { id: 'caddie', name: 'Caddie Turbo', shop: 'vehicles', vehicle: 'caddie', price: 1200, level: 2, emoji: '🛒', desc: 'Volé ? Non. "Emprunté pour la science".', max: 1 },
    { id: 'scooter', name: 'Scooter', shop: 'vehicles', vehicle: 'scooter', price: 1800, level: 3, emoji: '🛵', desc: 'Vroum, mais poliment.', max: 1 },
    { id: 'voiturette', name: 'Voiturette', shop: 'vehicles', vehicle: 'voiturette', price: 4500, level: 5, emoji: '🚗', desc: 'Deux places, dont une pour votre animal.', max: 1 },
    ...NEW_CARS,
    { id: 'peinture', name: 'Peinture personnalisée', shop: 'vehicles', consumable: true, price: 150, emoji: '🎨', desc: 'Change la couleur d\'un de vos véhicules.', special: 'paint' },
  ],

  // Récompenses des mini-jeux (le serveur calcule TOUJOURS la récompense lui-même à partir du score).
  minigames: [
    { id: 'tartes', name: 'Bataille de tartes', emoji: '🥧', spot: 'pieToss', duration: 40, kind: 'score', targets: 40, reward: { base: 10, per: 2, cap: 90 }, xp: { base: 10, per: 1, cap: 60 },
      rules: 'Lance des tartes (clic / bouton) sur les cibles en carton. Cible normale : +1. Cible dorée : +3. Ne touche PAS Mamie Simone : -2. 40 secondes !' },
    { id: 'parcours', name: 'Parcours du Combattant Mou', emoji: '🏃', spot: 'obstacle', kind: 'time', minTime: 11, maxTime: 180, reward: { gold: 26, silver: 38, bronze: 60, gold_pc: 80, silver_pc: 50, bronze_pc: 30, finish_pc: 15 }, xp: { base: 25 },
      rules: 'Traverse les 6 anneaux dans l\'ordre le plus vite possible. Attention aux bras tournants et aux plateformes qui bougent. Tomber dans la boue te renvoie au dernier anneau.' },
    { id: 'poulets', name: 'Course de poulets', emoji: '🐔', spot: 'chickenRace', duration: 60, kind: 'score', chickens: 12, reward: { base: 10, per: 6, cap: 90 }, xp: { base: 10, per: 3, cap: 50 },
      rules: 'Attrape les poulets (approche-toi et appuie sur E / bouton main) puis ramène-les dans le panier au centre de l\'enclos. 60 secondes. Un poulet à la fois !' },
  ],
};
