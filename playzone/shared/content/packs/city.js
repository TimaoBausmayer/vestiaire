// Pack "La Grande Ville" (mise à jour du monde ouvert) : nourriture et boissons des restaurants et
// commerces, électronique, accessoires pour animaux, équipement deux-roues, nouveaux meubles.
// food = effet quand on mange / boit : { faim, energie, humeur } (jauges sur 100).

const F = (id, name, shop, price, emoji, desc, food, extra = {}) => ({ id, name, shop, price, emoji, desc, consumable: true, food, max: 20, ...extra });

export default {
  id: 'ville',
  name: 'La Grande Ville',
  version: '0.2.0',
  items: [
    // ---------- Boulangeries (La Mie Câline, des Tilleuls)
    F('croissant', 'Croissant', 'bakery', 4, '🥐', 'Feuilleté, doré, et qui fait plein de miettes.', { faim: 18, energie: 4, humeur: 3 }),
    F('pain-choc', 'Pain au chocolat', 'bakery', 4, '🍫', 'Ou chocolatine. Le débat est ouvert.', { faim: 20, energie: 4, humeur: 4 }),
    F('baguette', 'Baguette tradition', 'bakery', 3, '🥖', 'On en mange le bout avant d\'arriver chez soi.', { faim: 25, energie: 2, humeur: 2 }),
    F('eclair', 'Éclair au café', 'bakery', 5, '🍮', 'Disparaît à la vitesse de l\'éclair.', { faim: 15, energie: 6, humeur: 6 }),
    F('sandwich', 'Sandwich jambon-beurre', 'bakery', 7, '🥪', 'Le classique du midi.', { faim: 40, energie: 5, humeur: 2 }),
    // ---------- Cafés
    F('cafe-noir', 'Café serré', 'cafe', 3, '☕', 'Réveille un ours en hibernation.', { faim: 0, energie: 25, humeur: 2 }),
    F('chocolat', 'Chocolat chaud', 'cafe', 4, '🍫', 'Avec de la mousse. Beaucoup de mousse.', { faim: 6, energie: 10, humeur: 8 }),
    F('jus-orange', 'Jus d\'orange pressé', 'cafe', 4, '🧃', 'Pressé à la main par un serveur pressé.', { faim: 5, energie: 12, humeur: 4 }),
    F('cafe-bureau', 'Café "réunion"', 'cafe2', 3, '☕', 'Indispensable avant une réunion qui aurait pu être un e-mail.', { faim: 0, energie: 28, humeur: 0 }),
    F('muffin', 'Muffin myrtille', 'cafe2', 4, '🧁', 'Plus de myrtilles que de muffin.', { faim: 20, energie: 6, humeur: 5 }),
    F('cocktail', 'Cocktail de fruits', 'paillote', 6, '🍹', 'Avec une petite ombrelle (non comestible).', { faim: 8, energie: 10, humeur: 12 }),
    F('glace', 'Glace trois boules', 'paillote', 5, '🍦', 'Vanille, fraise, et une boule mystère.', { faim: 12, energie: 4, humeur: 12 }),
    // ---------- Le Burger Absurde
    F('burger', 'Burger Absurde', 'burger', 9, '🍔', 'Steak, cornichon, et une tranche de doute.', { faim: 55, energie: 8, humeur: 6 }),
    F('frites', 'Cornet de frites', 'burger', 4, '🍟', 'Croustillantes dehors, fondantes dedans.', { faim: 25, energie: 4, humeur: 5 }),
    F('soda', 'Soda pétillant', 'burger', 3, '🥤', 'Fait des bulles jusque dans le nez.', { faim: 2, energie: 10, humeur: 4 }),
    F('menu-geant', 'Menu Géant', 'burger', 16, '🍱', 'Burger + frites + soda. Sieste non incluse.', { faim: 80, energie: 15, humeur: 12 }),
    // ---------- Pizzeria, tacos, restaurants
    F('pizza', 'Pizza Margherita', 'pizzeria', 11, '🍕', 'Tomate, mozzarella, basilic. Et un chat qui la regarde.', { faim: 65, energie: 10, humeur: 8 }),
    F('pizza-ananas', 'Pizza Ananas', 'pizzeria', 12, '🍍', 'Commander celle-ci déclenche un débat dans tout le restaurant.', { faim: 60, energie: 10, humeur: 10 }),
    F('tiramisu', 'Tiramisu', 'pizzeria', 6, '🍰', '"Tire-moi vers le haut". Ça marche.', { faim: 18, energie: 8, humeur: 10 }),
    F('tacos-xl', 'Tacos XL', 'tacos', 10, '🌮', 'Pèse autant qu\'un petit chien.', { faim: 70, energie: 8, humeur: 6 }),
    F('burrito', 'Burrito Tornade', 'tacos', 9, '🌯', 'Roulé à la vitesse d\'une tornade.', { faim: 60, energie: 8, humeur: 6 }),
    F('nachos', 'Nachos fromage', 'tacos', 6, '🧀', 'Le fromage file jusqu\'au plafond.', { faim: 30, energie: 4, humeur: 8 }),
    F('homard', 'Homard Hilarant', 'homard', 45, '🦞', 'Il rigole encore. C\'est un peu gênant.', { faim: 70, energie: 12, humeur: 20 }),
    F('soupe-poisson', 'Soupe de poisson', 'homard', 14, '🍲', 'Avec croûtons et rouille.', { faim: 40, energie: 10, humeur: 6 }),
    F('fish-chips', 'Fish & chips', 'poisson', 12, '🐟', 'Le poisson du jour (le jour où il a été pêché).', { faim: 55, energie: 8, humeur: 6 }),
    F('moules', 'Moules-frites', 'poisson', 15, '🦪', 'Un seau entier. Le seau ne se mange pas.', { faim: 65, energie: 10, humeur: 8 }),
    // ---------- Supermarchés (Hyper Bazar, Supérette du Coin) et produits de la ferme
    F('pomme', 'Pomme', 'supermarket', 2, '🍎', 'Une par jour éloigne le médecin (mais pas le facteur).', { faim: 10, energie: 3, humeur: 1 }, { also: ['superette', 'farm'] }),
    F('chips', 'Paquet de chips', 'supermarket', 3, '🥔', 'Format "partage" (personne ne partage).', { faim: 18, energie: 3, humeur: 5 }, { also: ['superette', 'station'] }),
    F('eau', 'Bouteille d\'eau', 'supermarket', 1, '💧', 'L\'eau, ça mouille. Et ça désaltère.', { faim: 0, energie: 6, humeur: 1 }, { also: ['superette', 'station'] }),
    F('pates', 'Paquet de pâtes', 'supermarket', 3, '🍝', 'À cuisiner chez soi (cuisinière). Crues, c\'est croquant.', { faim: 8, energie: 2, humeur: -2 }, { also: ['superette'], ingredient: true }),
    F('oeufs', 'Boîte d\'œufs', 'supermarket', 4, '🥚', 'À cuisiner chez soi. Parfait pour une omelette.', { faim: 6, energie: 2, humeur: -2 }, { also: ['superette', 'farm'], ingredient: true }),
    F('legumes', 'Panier de légumes', 'farm', 6, '🥕', 'Frais du jour. À cuisiner chez soi.', { faim: 10, energie: 4, humeur: 0 }, { also: ['supermarket'], ingredient: true }),
    F('riz', 'Sachet de riz', 'supermarket', 2, '🍚', 'À cuisiner chez soi. Un grain de folie dans chaque grain.', { faim: 6, energie: 2, humeur: -3 }, { also: ['superette'], ingredient: true }),
    F('lait', 'Brique de lait', 'supermarket', 2, '🥛', 'Pour les crêpes. Ou une moustache blanche.', { faim: 6, energie: 4, humeur: 1 }, { also: ['superette', 'farm'], ingredient: true }),
    F('farine', 'Paquet de farine', 'supermarket', 2, '🌾', 'À cuisiner chez soi. Pas à manger tel quel (on a testé).', { faim: 2, energie: 0, humeur: -5 }, { also: ['superette', 'farm'], ingredient: true }),
    F('fromage-rape', 'Fromage râpé', 'supermarket', 3, '🧀', 'Pour gratiner tout ce qui bouge (et ce qui ne bouge pas).', { faim: 8, energie: 2, humeur: 2 }, { also: ['superette'], ingredient: true }),
    F('tomates', 'Barquette de tomates', 'farm', 3, '🍅', 'Rouges, juteuses, un peu susceptibles.', { faim: 8, energie: 3, humeur: 1 }, { also: ['supermarket', 'superette'], ingredient: true }),
    F('steak-hache', 'Steak haché', 'supermarket', 5, '🥩', 'À cuire absolument. Cru, il fait la tête.', { faim: 10, energie: 2, humeur: -6 }, { ingredient: true }),
    F('fromage', 'Fromage qui pue', 'supermarket', 6, '🧀', 'Plus il sent fort, plus il est bon (paraît-il).', { faim: 22, energie: 4, humeur: 3 }, { also: ['farm'] }),
    F('glace-pot', 'Pot de glace', 'supermarket', 7, '🍨', 'Une cuillère... puis le pot entier.', { faim: 20, energie: 5, humeur: 14 }, { also: ['superette'] }),
    F('barre-choco', 'Barre chocolatée', 'station', 2, '🍫', 'Le carburant des pilotes.', { faim: 14, energie: 12, humeur: 4 }, { also: ['superette', 'supermarket'] }),
    F('sandwich-triangle', 'Sandwich triangle', 'station', 5, '🥪', 'Garanti presque frais.', { faim: 35, energie: 4, humeur: 0 }),
    F('miel', 'Pot de miel', 'farm', 8, '🍯', 'Récolté par des abeilles très sérieuses.', { faim: 15, energie: 15, humeur: 6 }),
    F('popcorn', 'Pop-corn géant', 'cinema', 5, '🍿', 'Il en tombera la moitié par terre.', { faim: 20, energie: 4, humeur: 8 }),

    // ---------- Électronique (Pixel & Câbles) : à installer chez soi
    { id: 'console-jeu', name: 'Console de jeu', shop: 'electronics', furniture: true, price: 450, emoji: '🎮', desc: 'Pour jouer à "Simulateur de PLAYZONE" dans PLAYZONE.' },
    { id: 'enceinte', name: 'Enceinte qui boume', shop: 'electronics', furniture: true, price: 220, emoji: '🔊', desc: 'Les voisins adorent (non).' },
    { id: 'ordinateur', name: 'Ordinateur de bureau', shop: 'electronics', furniture: true, price: 900, emoji: '💻', desc: 'Affiche 47 onglets ouverts en permanence.' },
    { id: 'tele-geante', name: 'Télé géante', shop: 'electronics', furniture: true, price: 1500, emoji: '📺', desc: 'Tellement grande qu\'on voit les pores des présentateurs.', level: 4 },
    { id: 'radio', name: 'Radio vintage', shop: 'electronics', furniture: true, price: 120, emoji: '📻', desc: 'Ne capte qu\'une station : "Radio Poulet".' },
    // ---------- Meubles Mous : cuisine et salle de bain (pour cuisiner et se doucher chez soi)
    { id: 'cuisiniere', name: 'Cuisinière', shop: 'furniture', furniture: true, price: 350, emoji: '🍳', desc: 'Pour cuisiner des pâtes, des omelettes... ou des catastrophes.' },
    { id: 'douche', name: 'Douche à l\'italienne', shop: 'furniture', furniture: true, price: 400, emoji: '🚿', desc: 'Chante sous la douche : c\'est obligatoire.' },
    { id: 'bureau', name: 'Bureau de ministre', shop: 'furniture', furniture: true, price: 280, emoji: '🗄️', desc: 'Impressionne les visiteurs. Et les pigeons.' },
    // ---------- Croquette Center : accessoires pour animaux
    { id: 'croquettes-premium', name: 'Croquettes premium', shop: 'pet-acc', consumable: true, price: 30, emoji: '🍖', desc: 'Nourrit un animal (+80 satiété). Il vous regardera avec amour.', petFood: 80 },
    { id: 'jouet-couinant', name: 'Jouet qui couine', shop: 'pet-acc', consumable: true, price: 20, emoji: '🧸', desc: 'Joie de l\'animal +50. Votre santé mentale -10.', petJoy: 50 },
    { id: 'panier-chien', name: 'Panier douillet', shop: 'pet-acc', furniture: true, price: 140, emoji: '🧺', desc: 'Votre animal y dormira... ou pas.' },
    { id: 'arbre-chat', name: 'Arbre à chat', shop: 'pet-acc', furniture: true, price: 260, emoji: '🌳', desc: 'Un arbre d\'intérieur où personne ne reste coincé.' },
    // ---------- Deux-Roues Express : équipement
    { id: 'peluche-poulet', name: 'Peluche poulet géante', furniture: true, price: 60, emoji: '🐥', desc: 'Gagnée à la pince de la salle d\'arcade. Elle vous juge un peu.' },
    { id: 'casque-moto', name: 'Casque intégral', shop: 'bikes', slot: 'hat', price: 180, emoji: '⛑️', desc: 'Protège la tête et cache les mauvais jours de coiffure.' },
  ],
};
