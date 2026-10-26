// DISCUSSION LIBRE avec les habitant·es : le joueur écrit ce qu'il veut, le PNJ répond selon ce qu'il a
// compris (salutations, humeur, prénom, métier, heure, météo, chemin vers un lieu, conseils, blagues,
// compliments, insultes, drague...). Il se souvient du prénom du joueur et de son humeur envers lui.
import { BUILDINGS } from './world-layout.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, '\'');
const any = (t, list) => list.some((w) => (w.includes(' ') || w.includes('\'') ? t.includes(w) : new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t)));
const pick = (a, r) => a[Math.floor(r() * a.length)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const JOKES = [
  'Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tombent dans le bateau.',
  'Qu\'est-ce qu\'un canif ? Un petit fien.',
  'Le policier m\'a dit : « Papiers ! » J\'ai répondu : « Ciseaux ! » J\'ai gagné.',
  'Que dit un pigeon à un autre pigeon ? Rien, il roucoule. Mais il pense très fort.',
  'Pourquoi le livre de maths est triste ? Il a trop de problèmes.',
  'C\'est l\'histoire d\'un wingfoileur qui n\'avait pas de vent. Il pompe encore.',
];
const MOODS = ['Super bien ! Le soleil, les PlayCoins, la vie quoi.', 'Ça va, ça va... un peu fatigué·e, mais ça va.', 'Comme un lundi. Même quand ce n\'est pas lundi.', 'Au top ! J\'ai trouvé une pièce par terre ce matin.', 'Bof, mon chat m\'ignore. Encore.'];
const PLACES = [
  // mots clés → identifiant (ou filtre) de bâtiment
  [['banque', 'distributeur', 'argent liquide'], (b) => b.interior === 'bank'],
  [['police', 'commissariat', 'flic'], (b) => b.id === 'police'],
  [['tribunal', 'juge', 'justice'], (b) => b.id === 'tribunal'],
  [['hopital', 'medecin', 'docteur', 'malade'], (b) => b.interior === 'hospital'],
  [['prison'], (b) => b.interior === 'prison'],
  [['voile', 'bateau', 'laser', 'optimist', 'kite', '49er', '29er', 'ilca'], (b) => b.id === 'club-voile'],
  [['wing', 'foil', 'surf'], (b) => b.shop === 'surf'],
  [['pizza', 'pizzeria'], (b) => /pizz/i.test(b.name)],
  [['voiture', 'concession', 'acheter une voiture'], (b) => b.interior === 'showroom'],
  [['manger', 'faim', 'restaurant', 'resto', 'pizza', 'burger', 'tacos'], (b) => ['restaurant', 'fastfood'].includes(b.interior)],
  [['cafe', 'croissant', 'boulangerie', 'pain'], (b) => ['cafe', 'bakery'].includes(b.interior)],
  [['supermarche', 'courses', 'magasin'], (b) => b.interior === 'supermarket' || b.interior === 'minimarket'],
  [['garage', 'reparer ma voiture', 'mecanicien'], (b) => b.interior === 'workshop'],
  [['essence', 'station', 'carburant'], (b) => !!b.gas],
  [['casino', 'jouer', 'roulette'], (b) => /casino/i.test(b.name)],
  [['cinema', 'film'], (b) => b.interior === 'cinema'],
  [['sport', 'muscu', 'salle de gym', 'gym'], (b) => b.interior === 'gym'],
  [['coiffeur', 'cheveux', 'coupe'], (b) => b.interior === 'salon'],
  [['mairie', 'maire'], (b) => b.interior === 'mairie' || /mairie/i.test(b.name)],
  [['auto-ecole', 'permis', 'code de la route'], (b) => b.id === 'auto-ecole'],
  [['immobilier', 'appartement', 'maison a acheter', 'louer'], (b) => b.interior === 'agency'],
  [['karting', 'kart'], (b) => /kart/i.test(b.name)],
  [['ecole', 'formation', 'diplome'], (b) => b.interior === 'school'],
];
const CARD = ['au nord', 'au nord-est', 'à l\'est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l\'ouest', 'au nord-ouest'];
function directions(from, b) {
  const dx = b.x - from.x, dz = b.z - from.z, d = Math.hypot(dx, dz);
  const a = Math.atan2(dx, -dz);                          // 0 = nord (z négatif), sens horaire
  const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  if (d < 25) return `${b.name} ? C'est juste là, à côté de nous !`;
  const dist = d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`;
  return `${b.name} ? C'est ${CARD[k]}, à environ ${dist}. ${d > 400 ? 'Mets-le dans ton GPS (téléphone), ou prends un taxi !' : 'Tu peux y aller à pied.'}`;
}
function findPlace(t, pos) {
  for (const [keys, f] of PLACES) {
    if (!any(t, keys)) continue;
    const list = BUILDINGS.filter(f);
    if (!list.length) continue;
    return list.reduce((a, b) => (Math.hypot(b.x - pos.x, b.z - pos.z) < Math.hypot(a.x - pos.x, a.z - pos.z) ? b : a));
  }
  // nom propre d'un bâtiment cité tel quel (« le Homard Hilarant »)
  const words = t.split(/[^a-z0-9']+/).filter((w) => w.length >= 5);
  return BUILDINGS.find((b) => words.some((w) => norm(b.name).includes(w))) || null;
}

// Réponse d'un PNJ. who : { name, role }, ctx : { hour, kts, rain, pos, player }, mem : mémoire (mutée).
export function npcReply(text, who, ctx = {}, mem = {}, rand = Math.random) {
  const t = norm(text).trim().slice(0, 300);
  const me = who.name || 'Moi', you = mem.playerName || ctx.player || '';
  mem.count = (mem.count || 0) + 1;
  mem.mood = mem.mood ?? 0;
  const tag = (s) => (you && rand() < 0.3 ? `${s.replace(/\s*[.!]+$/, '')}, ${you} !` : s);
  if (!t) return '... Tu voulais dire quelque chose ?';
  // il ou elle boude après des insultes
  if (any(t, ['con', 'conne', 'connard', 'idiot', 'debile', 'nul', 'nulle', 'moche', 'ta gueule', 'degage', 'cretin', 'abruti', 'boloss'])) {
    mem.mood -= 2;
    return pick(['Pardon ?! On ne se connaît même pas !', 'Charmant. Vraiment charmant.', 'Je vais faire semblant de ne pas avoir entendu.', 'Bon, je crois que la discussion est terminée.'], rand);
  }
  if (mem.mood <= -3) return pick(['...', 'Je ne te parle plus.', 'Va voir ailleurs si j\'y suis.'], rand);
  const m = t.match(/(?:je m'appelle|mon nom c'est|mon nom est|moi c'est)\s+([a-z\-]{2,20})/);
  if (m) { mem.playerName = cap(m[1]); mem.mood += 1; return `Enchanté·e, ${mem.playerName} ! Moi, c'est ${me}.`; }
  if (any(t, ['merci'])) { mem.mood += 1; return tag(pick(['Avec plaisir !', 'De rien, c\'est normal.', 'Pas de quoi !'], rand)); }
  if (any(t, ['au revoir', 'a plus', 'a bientot', 'bye', 'ciao', 'bonne journee', 'bonne soiree', 'a la prochaine'])) return tag(pick(['À la prochaine !', 'Salut, prends soin de toi !', 'Bonne route !'], rand));
  // où se trouve...
  if (any(t, ['ou est', 'ou se trouve', 'c\'est ou', 'ou il y a', 'ou y a', 'ou trouver', 'ou je peux', 'comment aller', 'le chemin', 'je cherche', 'ou acheter', 'ou manger']) || (/(^|[^a-z])ou /.test(t) && t.includes('?'))) {
    const b = findPlace(t, ctx.pos || { x: 0, z: 0 });
    return b ? directions(ctx.pos || { x: 0, z: 0 }, b) : pick(['Aucune idée, désolé·e ! Regarde la carte de ton téléphone.', 'Hmm, ça ne me dit rien. Le GPS du téléphone saura sûrement.'], rand);
  }
  if (any(t, ['comment tu t\'appelle', 'ton nom', 'ton prenom', 'qui es-tu', 'qui es tu', 't\'es qui', 'tu t\'appelles', 'vous appelez'])) return `Je m'appelle ${me}${who.role ? `, ${who.role.toLowerCase()}` : ''}. Et toi ?`;
  if (any(t, ['ca va', 'comment vas', 'comment allez', 'la forme', 'quoi de neuf', 'tu vas bien', 'bien ou quoi'])) return `${pick(MOODS, rand)} Et toi ?`;
  if (any(t, ['bonjour', 'salut', 'coucou', 'hello', 'bonsoir', 'yo', 'hey', 'wesh'])) {
    const h = ctx.hour ?? 12;
    return tag(h >= 18 || h < 5 ? pick(['Bonsoir !', 'Salut ! Belle soirée, hein ?'], rand) : pick(['Bonjour !', 'Salut ! Quel beau temps pour se promener.', 'Coucou ! Ça faisait longtemps... ou pas, en fait je ne te connais pas.'], rand));
  }
  if (any(t, ['tu fais quoi', 'ton metier', 'ton travail', 'tu travailles', 'ton boulot', 'tu bosses'])) return who.role ? `Je suis ${who.role.toLowerCase()}. ${pick(['C\'est un métier passionnant... la plupart du temps.', 'Ça paie les factures !', 'Et j\'adore ça.'], rand)}` : 'Je me promène, je profite de la ville !';
  if (any(t, ['quelle heure', 'il est quelle heure', 'l\'heure'])) { const h = ctx.hour ?? 12; return `Il est à peu près ${Math.floor(h)} h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}.`; }
  if (any(t, ['meteo', 'il fait beau', 'pluie', 'pleut', 'soleil', 'vent', 'temps qu\'il fait', 'quel temps', 'froid', 'chaud'])) {
    const k = Math.round(ctx.kts ?? 10);
    return `${ctx.rain ? 'Il pleut, prends un parapluie !' : 'Pas de pluie en vue.'} Le vent souffle à ${k} nœuds${k >= 15 ? ' : parfait pour le wingfoil ou le kite !' : k < 8 ? ' : pour le wingfoil, prends une grande aile (ou va au Cap Venteux, là-bas ça souffle toujours).' : '.'}`;
  }
  if (any(t, ['blague', 'drole', 'fais moi rire', 'rigoler', 'raconte'])) return pick(JOKES, rand);
  if (any(t, ['argent', 'riche', 'gagner', 'thune', 'fric', 'sous', 'job', 'emploi'])) return pick(['Pour gagner de l\'argent : trouve un emploi (il y a des offres dans presque tous les bâtiments), ou tente le loto... une chance sur cent !', 'Les métiers paient mieux quand tu montes en niveau. Et la bourse, si tu aimes le risque.', 'Mon conseil : un bon job, un livret à la banque, et pas de braquage. Le tribunal ne rigole pas.'], rand);
  if (any(t, ['loto', 'loterie', 'ticket'])) return 'Le loto ? 10 PC le ticket, un par jour, et une chance sur cent de gagner un million ! Ça se joue sur le téléphone, appli Loto.';
  if (any(t, ['wingfoil', 'wing', 'foil', 'kite', 'voile', 'bateau', 'surf'])) return 'Le meilleur spot, c\'est le Cap Venteux, à l\'ouest : jamais moins de 15 nœuds ! Le club de voile prête des Optimist, des Laser, des 49er... et même des kites.';
  if (any(t, ['police', 'prison', 'avocat', 'amende'])) return pick(['Évite les ennuis ! Mais si tu te fais arrêter, explique-toi bien : les agents écoutent les bonnes raisons.', 'La prison, c\'est 10 minutes en vrai... et trois fois plus si tu te déconnectes !'], rand);
  if (any(t, ['beau', 'belle', 'mignon', 'mignonne', 'sympa', 'gentil', 'gentille', 'cool', 'super', 'genial', 'stylé', 'style'])) { mem.mood += 1; return tag(pick(['Oh, merci ! Tu es gentil·le.', 'Ça me fait plaisir, merci !', 'Arrête, je vais rougir.'], rand)); }
  if (any(t, ['rendez-vous', 'rendez vous', 'sortir avec', 'ton numero', 'un verre', 'diner', 'je t\'aime', 'tu me plais', 'celibataire'])) {
    return mem.mood >= 2 ? pick(['Pourquoi pas... on se retrouve au café ?', 'Hihi, tu es direct·e ! Disons... peut-être.'], rand) : pick(['Haha, on se connaît à peine !', 'Doucement ! Commence par me dire bonjour.', 'Je suis flatté·e, mais non merci.'], rand);
  }
  if (any(t, ['voiture', 'voitures', 'bagnole', 'caisse'])) return pick(['Les plus belles voitures sont chez les concessionnaires de l\'Avenue de Prestige. Et avec le permis, elles se conduisent bien mieux !', 'Moi, je rêve d\'une décapotable. En attendant, je prends le bus.'], rand);
  if (any(t, ['content', 'contente', 'heureux', 'heureuse', 'ravi', 'ravie'])) { mem.mood += 1; return tag(pick(['Moi aussi, ça me fait plaisir !', 'Ça fait plaisir à entendre !'], rand)); }
  if (any(t, ['triste', 'deprime', 'seul', 'seule', 'pas le moral'])) return 'Oh... Tu veux en parler ? Une balade sur la plage, ça remonte souvent le moral.';
  if (any(t, ['tu aimes', 'tu preferes', 'ton prefere', 'ta prefere'])) return pick(['J\'adore les crêpes, le foot le dimanche et les pigeons qui ne me volent pas mon sandwich.', 'Moi ? La plage au coucher du soleil. Et la pizza.', 'Les karts ! Je suis imbattable. Enfin presque.'], rand);
  if (any(t, ['aide', 'aider', 'help', 'perdu', 'je sais pas quoi faire', 'ennuie'])) return 'Ouvre ton téléphone (touche P) : carte, GPS, missions, réseau social... Sinon, va faire un tour au Cap Venteux ou au karting !';
  if (/^(oui|ouais|ok|d'accord|bien sur|carrement|grave)\b/.test(t)) return pick(['Super !', 'Parfait, alors.', 'Je savais qu\'on allait s\'entendre.'], rand);
  if (/^(non|nan|pas du tout|jamais)\b/.test(t)) return pick(['Ah. Bon. D\'accord.', 'Tant pis !', 'Comme tu veux.'], rand);
  if (/\b(bien|tres bien|nickel|parfait|bof|mal|fatigue)\b/.test(t) && mem.count > 1) return /bof|mal|fatigue/.test(t) ? 'Oh, courage ! Un bon café, ça aide.' : 'Tant mieux !';
  // incompris : on rebondit sur un mot du message
  const word = t.split(/[^a-z']+/).filter((w) => w.length >= 5).sort((a, b) => b.length - a.length)[0];
  if (t.endsWith('?')) return pick([`Bonne question ! ${word ? `${cap(word)}... ` : ''}je n'en sais trop rien, honnêtement.`, 'Hmm... demande plutôt à quelqu\'un de plus savant que moi !', 'Je ne sais pas, mais si tu trouves, dis-le-moi !'], rand);
  return pick([word ? `${cap(word)} ? Intéressant... raconte-m'en plus !` : 'Ah oui ? Raconte !', 'Je vois, je vois...', 'Ha ! Elle est bonne, celle-là.', `Tu sais, moi, je suis juste ${who.role ? who.role.toLowerCase() : 'de passage'}, mais je t'écoute.`], rand);
}

// ACTIONS : ce que le PNJ FAIT après ce qu'on lui a écrit (suivre, danser, s'asseoir, sauter, venir,
// partir, s'arrêter, fuir, se fâcher, être content, faire un câlin). Il accepte... ou pas, selon son humeur.
const ACTIONS = [
  ['stop', ['arrete', 'arretez', 'stop', 'reste la', 'reste ici', 'attends', 'attendez', 'ne bouge plus', 'bouge pas'], ['D\'accord, je m\'arrête.', 'OK, je reste là.', 'Je ne bouge plus !']],
  ['follow', ['suis moi', 'suis-moi', 'suivez moi', 'suivez-moi', 'viens avec moi', 'accompagne moi', 'accompagne-moi', 'on y va', 'allons-y', 'allez viens'], ['C\'est parti, je te suis !', 'OK, je te suis. Pas trop vite, hein !', 'En route, chef !']],
  ['come', ['viens', 'venez', 'approche', 'viens ici', 'viens la'], ['J\'arrive !', 'Me voilà !', 'Oui, oui, j\'arrive.']],
  ['dance', ['danse', 'dansez', 'on danse', 'bouge ton corps', 'fais la fete', 'musique'], ['Ah, tu veux voir mes pas de danse ? Regarde ça !', 'Musique, maestro !', 'Je suis le roi (ou la reine) de la piste !']],
  ['sit', ['assieds toi', 'assieds-toi', 'asseyez-vous', 'asseyez vous', 'assis', 'repose toi', 'repose-toi'], ['Bonne idée, mes pieds me tuent.', 'Hop, je m\'assois.', 'Ahhh, ça fait du bien.']],
  ['jump', ['saute', 'sautez', 'sauter', 'fais un saut'], ['Hop ! Hop ! Hop !', 'Comme un kangourou !', 'Boing !']],
  ['wave', ['fais coucou', 'fais signe', 'salue', 'dis bonjour'], ['Coucou tout le monde !', 'Salut, salut !']],
  ['leave', ['va-t-en', 'va t en', 'vas-t-en', 'va t\'en', 'degage', 'pars', 'laisse moi', 'laisse-moi', 'fiche moi la paix', 'casse toi', 'dégage'], ['Bon, bon, je m\'en vais...', 'Pas besoin d\'être aussi méchant·e !', 'D\'accord, je pars. Vexé·e.']],
  ['run', ['cours', 'courez', 'fuis', 'sauve toi', 'sauve-toi', 'au feu', 'attention', 'police', 'un monstre', 'au secours'], ['AAAH ! Je cours !', 'Sauve qui peut !', 'Pas besoin de me le dire deux fois !']],
  ['hug', ['calin', 'câlin', 'faire un bisou', 'bisou', 'serre moi', 'embrasse'], ['Oh, un câlin ! Viens là !', 'Bon, d\'accord, un petit câlin.']],
];
const RUDE = ['con', 'conne', 'connard', 'idiot', 'debile', 'nul', 'nulle', 'moche', 'ta gueule', 'cretin', 'abruti', 'boloss'];
const NICE = ['beau', 'belle', 'mignon', 'mignonne', 'sympa', 'gentil', 'gentille', 'cool', 'genial', 'merci', 'je t\'aime', 'bravo', 'super'];

// Renvoie { type, reply } (ou null : pas d'action). mood : humeur du PNJ envers le joueur.
export function npcAction(text, mood = 0, rand = Math.random) {
  const t = norm(text);
  if (any(t, RUDE)) return { type: rand() < 0.5 ? 'angry' : 'leave', reply: null };
  for (const [type, words, replies] of ACTIONS) {
    if (!any(t, words)) continue;
    // de mauvaise humeur, on refuse les demandes (sauf partir ou s'arrêter)
    if (mood <= -2 && !['leave', 'stop', 'run'].includes(type)) return { type: 'refuse', reply: pick(['Non. Pas après ce que tu m\'as dit.', 'Même pas en rêve.', 'Demande plus gentiment...'], rand) };
    return { type, reply: pick(replies, rand) };
  }
  if (any(t, NICE)) return { type: 'happy', reply: null };
  return null;
}
