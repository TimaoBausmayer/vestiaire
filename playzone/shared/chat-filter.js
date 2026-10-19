// Filtre de langage pour le chat et les noms (liste volontairement courte, à compléter).
// On normalise (accents, chiffres déguisés, lettres répétées) avant de comparer.

const BAD = [
  'merde', 'putain', 'pute', 'connard', 'connasse', 'salope', 'encule', 'enculer', 'batard', 'bite', 'couille',
  'nique', 'niquer', 'ntm', 'fdp', 'pd', 'tg', 'ta gueule', 'negre', 'bougnoule', 'youpin', 'tapette', 'gouine',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'nigger', 'nigga', 'faggot', 'whore', 'slut',
  'nazi', 'hitler', 'suicide', 'viol', 'violer',
];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

export function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[0134579@$!]/g, (c) => LEET[c] || c)
    .replace(/(.)\1{2,}/g, '$1$1');
}

const patterns = BAD.map((w) => new RegExp(`(^|[^a-z])${w.replace(/ /g, '[^a-z]*')}(?=$|[^a-z])`, 'g'));

export function isClean(text) {
  const n = normalize(text);
  return !patterns.some((p) => { p.lastIndex = 0; return p.test(n); });
}

// Remplace les mots interdits par des étoiles (en gardant la longueur approximative).
export function censor(text) {
  const n = normalize(text);
  if (n.length !== text.length) return isClean(text) ? text : '***';
  let out = text.split('');
  for (const p of patterns) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(n))) {
      const start = m.index + m[1].length;
      const end = m.index + m[0].length;
      for (let i = start; i < end; i++) if (out[i] !== ' ') out[i] = '*';
    }
  }
  return out.join('');
}

// Coordonnées, liens et numéros de téléphone : interdits dans le chat (sécurité des jeunes joueurs).
export function hasPersonalInfo(text) {
  return /(https?:\/\/|www\.|\.com\b|\.fr\b|discord\.gg|@[a-z0-9_]{3,}\.)/i.test(text)
    || /(\+33|0)[1-9]([ .-]?\d{2}){4}/.test(text)
    || /\b\d{9,}\b/.test(text);
}
