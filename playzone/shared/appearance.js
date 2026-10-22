// Apparence des personnages : valeurs autorisées (le serveur refuse tout le reste).
// Les styles de base sont gratuits ; chapeaux, lunettes, accessoires et hauts spéciaux viennent de la boutique.

export const SKINS = ['#ffe0c4', '#f6cfa3', '#f1c27d', '#e0ac69', '#c68642', '#a86b3c', '#8d5524', '#5c3a1e', '#9fd8a8', '#a9c1ff'];
export const HAIR_STYLES = ['court', 'herisse', 'long', 'chignon', 'afro', 'crete', 'couettes', 'meche', 'chauve'];
export const HAIR_LABELS = { court: 'Court', herisse: 'Hérissé', long: 'Long', chignon: 'Chignon', afro: 'Afro', crete: 'Crête', couettes: 'Couettes', meche: 'Mèche', chauve: 'Chauve' };
export const EYE_COLORS = ['#5b3a1e', '#3b2412', '#2f6f9f', '#3f8f5a', '#7a8a99', '#8a5a2b', '#14141c'];
export const HAIR_COLORS = ['#1f1611', '#4a2f1b', '#8a5a2b', '#d9a441', '#f2e2b1', '#b5452f', '#e8e8e8', '#ff5ab4', '#3fa7ff', '#5fd068'];
export const EYES = ['rond', 'joyeux', 'serieux', 'endormi'];
export const EYE_LABELS = { rond: 'Curieux', joyeux: 'Joyeux', serieux: 'Sérieux', endormi: 'Endormi' };
export const BODIES = ['mince', 'moyen', 'costaud'];
export const COLORS = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#7ac74f', '#2ec4b6', '#3d8ee8', '#5b3fa6', '#c77dff', '#ff8fab', '#f4f1ea', '#9aa5b1', '#2b2d42', '#7a5230', '#1b4332', '#e63946', '#14213d'];
export const BASE_TOPS = ['tshirt', 'sweat', 'debardeur'];
export const BASE_BOTTOMS = ['jean', 'short'];
export const TOP_LABELS = { tshirt: 'T-shirt', sweat: 'Sweat', debardeur: 'Débardeur' };
export const BOTTOM_LABELS = { jean: 'Pantalon', short: 'Short' };

export const DEFAULT_APPEARANCE = {
  skin: '#f1c27d', hair: 'court', hairColor: '#4a2f1b', eyeColor: '#5b3a1e', eyes: 'rond', body: 'moyen', height: 1,
  top: 'tshirt', topColor: '#ff5a5f', bottom: 'jean', bottomColor: '#3d8ee8', shoes: '#2b2d42',
  hat: null, glasses: null, back: null, feet: null,
};

const isColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Nettoie une apparence reçue d'un client. catalog = { [itemId]: item } ; owned = Set des objets possédés.
export function sanitizeAppearance(app, catalog, owned) {
  const a = { ...DEFAULT_APPEARANCE };
  if (!app || typeof app !== 'object') return a;
  if (SKINS.includes(app.skin)) a.skin = app.skin;
  if (HAIR_STYLES.includes(app.hair)) a.hair = app.hair;
  if (HAIR_COLORS.includes(app.hairColor)) a.hairColor = app.hairColor;
  if (EYE_COLORS.includes(app.eyeColor)) a.eyeColor = app.eyeColor;
  if (EYES.includes(app.eyes)) a.eyes = app.eyes;
  if (BODIES.includes(app.body)) a.body = app.body;
  if (typeof app.height === 'number' && app.height >= 0.9 && app.height <= 1.1) a.height = Math.round(app.height * 100) / 100;
  if (COLORS.includes(app.topColor)) a.topColor = app.topColor;
  if (COLORS.includes(app.bottomColor)) a.bottomColor = app.bottomColor;
  if (COLORS.includes(app.shoes)) a.shoes = app.shoes;
  const slotOk = (slot, id) => id && catalog[id] && catalog[id].slot === slot && owned.has(id);
  if (BASE_TOPS.includes(app.top) || slotOk('top', app.top)) a.top = app.top;
  if (BASE_BOTTOMS.includes(app.bottom) || slotOk('bottom', app.bottom)) a.bottom = app.bottom;
  if (slotOk('hat', app.hat)) a.hat = app.hat;
  if (slotOk('glasses', app.glasses)) a.glasses = app.glasses;
  if (slotOk('back', app.back)) a.back = app.back;
  if (slotOk('feet', app.feet)) a.feet = app.feet;
  return a;
}

export { isColor };
