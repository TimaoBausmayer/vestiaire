// Les habitants de PLAYZONE : apparence, rôle, lieux de vie et répliques.
// kind : 'wander' (se promène entre ses points), 'stand' (reste à son poste), 'runner' (court partout).

const A = (o) => ({ skin: '#f1c27d', hair: 'court', hairColor: '#4a2f1b', eyes: 'rond', body: 'moyen', height: 1, top: 'tshirt', topColor: '#ff5a5f', bottom: 'jean', bottomColor: '#3d8ee8', shoes: '#2b2d42', hat: null, glasses: null, back: null, ...o });

export const NPCS = [
  {
    id: 'gerard', name: 'Gérard', role: 'Philosophe des pigeons', kind: 'wander', speed: 1.6,
    look: A({ skin: '#e0ac69', hair: 'chauve', hairColor: '#8a8a8a', eyes: 'serieux', top: 'chemise', topColor: '#9aa5b1', bottomColor: '#7a5230', glasses: 'lunettes-rondes' }),
    points: [[-10, 16], [10, 16], [-16, -2], [16, 6], [0, 18]], hints: 'secrets',
    lines: [
      'Les pigeons ne volent pas. Ils fuient vers le haut. Nuance.',
      'J\'ai compté les pavés de la place. Il y en a beaucoup. C\'est tout ce que je peux dire.',
      'On dit qu\'il y a des canards dorés cachés en ville. Les canards, eux, ne disent rien.',
      'La fontaine fait "glou glou". Moi aussi, parfois. Nous nous comprenons.',
    ],
  },
  {
    id: 'mamie', name: 'Mamie Turbo', role: 'Retraitée hyperactive', kind: 'runner', speed: 7,
    look: A({ skin: '#f6cfa3', hair: 'chignon', hairColor: '#e8e8e8', eyes: 'joyeux', top: 'sweat', topColor: '#c77dff', bottom: 'jupe', bottomColor: '#5b3fa6', shoes: '#ff5a5f', glasses: 'lunettes-soleil' }),
    points: [[-20, -20], [20, -20], [20, 20], [-20, 20]],
    lines: [
      'Pas le temps de discuter, mon record du parcours ne va pas se battre tout seul !',
      'À ton âge, je courais le marathon. Maintenant je le cours deux fois, pour compenser.',
      'Tu veux un bonbon ? Non ? Tant mieux, je les ai tous mangés.',
    ],
  },
  {
    id: 'kevin', name: 'Kevin', role: 'Influenceur en manque de contenu', kind: 'wander', speed: 1.9,
    look: A({ skin: '#ffe0c4', hair: 'meche', hairColor: '#d9a441', top: 'hawai', topColor: '#2ec4b6', bottom: 'short', bottomColor: '#ffd23f', shoes: '#f4f1ea', hat: 'casquette' }),
    points: [[-8, 10], [8, -10], [0, 40], [-20, 0], [24, 30], [0, -60]],
    lines: [
      'Salut la commu ! ... Ah, c\'est juste toi.',
      'Tu crois que si je filme un pigeon qui mange une frite, ça fait le buzz ?',
      'Abonne-toi ! Y a pas de bouton ? C\'est pas grave, fais semblant.',
      'Mon prochain défi : manger un burger du Burger Absurde sans comprendre ce qu\'il y a dedans.',
    ],
  },
  {
    id: 'maire', name: 'Le Maire Bidule', role: 'Maire de PLAYZONE', kind: 'stand', at: [11, -13.5], face: 3.14,
    look: A({ skin: '#f1c27d', hair: 'court', hairColor: '#e8e8e8', eyes: 'serieux', top: 'costume', topColor: '#14213d', bottomColor: '#14213d', glasses: 'moustache', hat: 'haut-de-forme' }),
    hints: 'events',
    lines: [
      'Bienvenue dans ma belle ville ! Évitez juste de regarder trop longtemps la fontaine.',
      'Le tableau des événements est juste là. Organisez une fête, c\'est bon pour ma réélection.',
      'Les poulets ? Quels poulets ? Il n\'y a aucun problème de poulets dans cette ville.',
    ],
  },
  {
    id: 'dj', name: 'DJ Patate', role: 'DJ résident', kind: 'stand', at: [0, -18.5], face: 0, y: 1.2,
    look: A({ skin: '#a86b3c', hair: 'afro', hairColor: '#1f1611', eyes: 'joyeux', top: 'tshirt', topColor: '#2b2d42', bottomColor: '#2b2d42', glasses: 'lunettes-soleil' }),
    lines: [
      'Ce soir, je mixe le bruit d\'une poule et celui d\'un klaxon. Ça va être énorme.',
      'Touche 1, 2 ou 3 pour danser. Le rythme, ça se travaille. Ou pas.',
      'Mon nom de scène, c\'est Patate. Mon vrai nom ? Patrice-Antoine. Je préfère Patate.',
    ],
  },
  {
    id: 'moustache', name: 'Mme Moustache', role: 'Voisine qui sait tout', kind: 'wander', speed: 1.3,
    look: A({ skin: '#f6cfa3', hair: 'couettes', hairColor: '#8a5a2b', top: 'chemise', topColor: '#ff8fab', bottom: 'jupe', bottomColor: '#7a5230', glasses: 'lunettes-rondes' }),
    points: [[80, 6], [96, -20], [96, 30], [110, -6], [70, -6]],
    lines: [
      'Le 3 avenue des Mouettes a encore reçu un colis. Je me demande ce que c\'est. (Je sais.)',
      'Il paraît qu\'un chat refuse de descendre d\'un arbre. Appelez les pompiers, ils adorent ça.',
      'Je ne commère jamais. J\'informe. Avec passion.',
    ],
  },
  {
    id: 'fermier', name: 'Fermier Bidoche', role: 'Fermier et poète', kind: 'wander', speed: 1.2,
    look: A({ skin: '#c68642', hair: 'court', hairColor: '#4a2f1b', top: 'chemise', topColor: '#d62828', bottom: 'jean', bottomColor: '#3d5a80', hat: 'paille' }),
    points: [[-70, 0], [-92, -8], [-75, 38], [-100, 10]],
    lines: [
      'Mes vaches écoutent du jazz. Le lait est plus doux. C\'est scientifique (selon moi).',
      'Les poulets du poulailler sont sages. Ce sont ceux du ciel qui m\'inquiètent.',
      'Un jour, je cultiverai des frites directement. On y travaille.',
    ],
  },
  {
    id: 'bob', name: 'Bob le Pêcheur', role: 'Pêcheur philosophe', kind: 'stand', at: [52, 120], face: 0, y: 0.55,
    look: A({ skin: '#e0ac69', hair: 'court', hairColor: '#e8e8e8', top: 'raye', topColor: '#14213d', bottomColor: '#ffd23f', hat: 'bonnet' }),
    lines: [
      'Ça fait trois jours que j\'attends une touche. Le poisson aussi, je crois.',
      'Méfie-toi du requin. Il est gentil, mais il fait des câlins trop forts.',
      'Le bout du ponton, c\'est là que les secrets flottent. Littéralement.',
    ],
  },
  {
    id: 'sandrine', name: 'Sandrine', role: 'Maître-nageuse', kind: 'wander', speed: 1.5,
    look: A({ skin: '#8d5524', hair: 'long', hairColor: '#1f1611', top: 'debardeur', topColor: '#ff5a5f', bottom: 'short', bottomColor: '#ff5a5f', shoes: '#ffd23f', glasses: 'lunettes-soleil' }),
    points: [[-22, 76], [-10, 82], [-35, 80], [10, 78]],
    lines: [
      'La baignade est surveillée. Par moi. Et par le requin, mais lui ne compte pas.',
      'Si tu nages loin, tu croiseras des tortues. Elles sont plus rapides qu\'on ne croit. Non, en fait.',
      'Protège-toi du soleil ! Même s\'il est en polygones.',
    ],
  },
  {
    id: 'coach', name: 'Coach Biscotte', role: 'Coach sportif', kind: 'stand', at: [22, -68], face: 3.14,
    look: A({ skin: '#5c3a1e', hair: 'crete', hairColor: '#ffd23f', body: 'costaud', top: 'debardeur', topColor: '#7ac74f', bottom: 'short', bottomColor: '#2b2d42', hat: 'bandeau' }),
    hints: 'course',
    lines: [
      'Le Parcours du Combattant Mou, c\'est pour les durs ! ... Mous. Bref.',
      'Astuce : saute AVANT le bord, pas après. Ça paraît évident, mais tu serais surpris.',
      'Mamie Turbo tient le record. Personne ne sait comment. Elle non plus.',
    ],
  },
  {
    id: 'paulette', name: 'Paulette', role: 'Marchande de fruits rêveuse', kind: 'stand', at: [15, 4], face: -1.57,
    look: A({ skin: '#ffe0c4', hair: 'chignon', hairColor: '#b5452f', top: 'tablier', topColor: '#7ac74f', bottom: 'jupe', bottomColor: '#2ec4b6' }),
    lines: [
      'Mes pommes sont rondes. C\'est une décision artistique.',
      'Un jour, je vendrai des fruits carrés. Pour qu\'ils se rangent mieux.',
      'Tu as vu le camion à burgers ? Le chef cherche toujours des cuisiniers.',
    ],
  },
  {
    id: 'jeanmi', name: 'Jean-Mi', role: 'Livreur vétéran', kind: 'stand', at: [36, -22], face: -1.57,
    look: A({ skin: '#f1c27d', hair: 'herisse', hairColor: '#4a2f1b', top: 'gilet-livreur', topColor: '#ffd23f', bottom: 'jean', hat: 'casquette-livreur', back: 'sac-livreur' }),
    lines: [
      'Livreur, c\'est un mode de vie. Tu cours, tu sonnes, tu repars. Zen.',
      'Les colis fragiles ? Ne saute pas. Je répète : NE SAUTE PAS.',
      'Prends les missions au comptoir, juste là. Plus tu livres, plus tu montes de niveau.',
    ],
  },
  {
    id: 'pompon', name: 'Capitaine Pompon', role: 'Chef des pompiers', kind: 'stand', at: [24, -34], face: 3.14,
    look: A({ skin: '#e0ac69', hair: 'court', hairColor: '#4a2f1b', body: 'costaud', top: 'uniforme-pompier', topColor: '#2b2d42', bottomColor: '#2b2d42', hat: 'casque-pompier', glasses: 'moustache' }),
    lines: [
      'Un pompier ne panique jamais. Sauf devant un chat qui le regarde de haut.',
      'Vise la base des flammes et maintiens le clic ! (ou le bouton, sur téléphone)',
      'On recrute ! Inscris-toi à la porte de la caserne.',
    ],
  },
  {
    id: 'gaspacho', name: 'Chef Gaspacho', role: 'Chef du Burger Absurde', kind: 'stand', at: [-12, 9.5], face: 1.57,
    look: A({ skin: '#ffe0c4', hair: 'court', hairColor: '#1f1611', body: 'costaud', top: 'tablier', topColor: '#f4f1ea', bottomColor: '#2b2d42', hat: 'toque', glasses: 'moustache' }),
    lines: [
      'Un burger, c\'est une histoire. Avec un début (le pain) et une fin (le pain).',
      'Le critique gastronomique a demandé un burger à la confiture. Je ne juge pas. Enfin, si.',
      'Aide-moi au camion, je paie en PlayCoins et en compliments.',
    ],
  },
  {
    id: 'zoe', name: 'Zoé', role: 'Gardienne du parc', kind: 'wander', speed: 1.4,
    look: A({ skin: '#c68642', hair: 'couettes', hairColor: '#ff5ab4', top: 'chemise', topColor: '#1b4332', bottom: 'short', bottomColor: '#7a5230', hat: 'cowboy' }),
    points: [[-8, -72], [-30, -100], [10, -118], [-12, -90]],
    lines: [
      'Ne nourrissez pas le crocodile. Il est au régime. Il le vit mal.',
      'La grande roue tourne depuis 1987. Personne ne sait comment l\'arrêter.',
      'Les lapins du parc sont timides. Ou snobs. Difficile à dire.',
    ],
  },
  {
    id: 'touriste', name: 'Un touriste perdu', role: 'Cherche la plage depuis mardi', kind: 'wander', speed: 1.7,
    look: A({ skin: '#ffe0c4', hair: 'chauve', top: 'hawai', topColor: '#ff9f1c', bottom: 'short', bottomColor: '#f4f1ea', hat: 'sombrero', back: 'sac-a-dos' }),
    points: [[30, 40], [-40, -30], [60, -40], [-30, 60], [0, -80], [90, 30]],
    lines: [
      'Excusez-moi, la plage, c\'est par où ? On m\'a dit "tout droit", mais lequel ?',
      'J\'ai pris 400 photos de la fontaine. Elle n\'a jamais souri.',
      'Je suis là depuis mardi. Quel jour on est ? Ah. Toujours mardi ?',
    ],
  },
];

export const CONVERSATIONS = [
  ['Tu savais que les pigeons ont un syndicat ?', 'Évidemment. Ils ont même une mutuelle.'],
  ['J\'ai vu un poulet conduire un caddie.', 'Encore ? Il faut qu\'on parle de sécurité routière.'],
  ['Il fait beau aujourd\'hui.', 'Oui. Suspicieusement beau.'],
  ['Tu as goûté le burger à la confiture ?', 'Une fois. J\'en parle encore à mon psy.'],
  ['La fontaine m\'a regardé bizarrement.', 'Elle fait ça à tout le monde. C\'est sa personnalité.'],
  ['Je me suis inscrit au parcours d\'obstacles.', 'Courageux. Moi je me suis inscrit à la sieste.'],
  ['Tu crois que le requin est gentil ?', 'Il est surtout très câlin. Trop câlin.'],
  ['On organise une fête ce soir ?', 'Seulement si DJ Patate ne mixe pas des bruits de vache.'],
  ['J\'ai perdu mon chapeau.', 'Il est sur ta tête.', ],
  ['Le maire a encore fait un discours.', 'Sur quoi ?', ],
  ['Ma voiture fait "pouet".', 'C\'est le klaxon, Bernard.'],
  ['Tu as vu la grande roue ?', 'Elle tourne. Comme ma tête quand je la regarde.'],
];

export const BUMP_LINES = [
  'Hé ! Doucement !', 'Aïe, mon cor au pied !', 'On ne court pas sur la place ! (C\'est écrit nulle part, mais quand même.)',
  'Tu as failli renverser mon café imaginaire.', 'Pardon... euh, non, c\'est TOI qui me dois des excuses.', 'Ouille ! Je vais le dire au maire.',
];

export const NIGHT_LINES = ['Il est tard... je devrais rentrer. Mais je tourne en rond, comme d\'habitude.', 'La nuit, la fontaine fait encore plus "glou glou".', 'Tu as entendu ? Les loups de la forêt chantent faux.'];
