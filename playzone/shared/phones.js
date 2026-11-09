// TÉLÉPHONES : plusieurs modèles à acheter (MégaTech, Pixel & Câbles), chacun avec ses couleurs et
// ses options. L'appareil photo change la qualité des photos (et les likes sur PlayGram), l'écran
// change la forme du téléphone à l'écran (encoche, île, poinçon, écran pliable, la vieille brique).
export const PHONES = {
  basique: { name: 'PlayPhone 11', brand: 'PlayPhone', price: 0, cam: 1, lenses: 1, screen: 'notch', width: 370, radius: 48, colors: { noir: '#2b2d42', blanc: '#f4f1ea', rouge: '#d62828' }, desc: 'Le téléphone de départ. Il fait le job.' },
  mini: { name: 'PlayPhone 15 mini', brand: 'PlayPhone', price: 3500, cam: 1.25, lenses: 2, screen: 'island', width: 330, radius: 44, colors: { rose: '#ff8fab', bleu: '#8ecae6', vert: '#95d5b2', minuit: '#22223b' }, desc: 'Petit, léger, double capteur photo.' },
  pro: { name: 'PlayPhone 15 Pro Max', brand: 'PlayPhone', price: 12000, cam: 2, lenses: 3, screen: 'island', width: 390, radius: 52, titanium: true, colors: { titane: '#8d8d8d', 'titane bleu': '#3d5a80', 'titane noir': '#1b1b1f', 'titane naturel': '#c8b8a6' }, desc: 'Triple capteur pro (photos ultra nettes : +40 % de likes), cadre en titane.' },
  galaxie: { name: 'Galaxie S Ultra', brand: 'Galaxie', price: 11000, cam: 1.9, lenses: 4, screen: 'punch', width: 384, radius: 30, square: true, colors: { 'noir fantôme': '#111318', violet: '#6d597a', crème: '#efe6d2', vert: '#52796f' }, desc: 'Quatre capteurs, zoom x100, écran aux coins carrés.' },
  pixou: { name: 'Pixou 8', brand: 'Pixou', price: 6000, cam: 1.7, lenses: 2, screen: 'punch', width: 372, radius: 40, bar: true, colors: { obsidienne: '#202124', porcelaine: '#f1ece3', menthe: '#b7e4c7' }, desc: 'Le meilleur appareil photo pour son prix, barre photo à l\'arrière.' },
  fold: { name: 'Galaxie Fold (pliable)', brand: 'Galaxie', price: 18000, cam: 1.8, lenses: 3, screen: 'punch', width: 540, radius: 34, fold: true, colors: { graphite: '#3a3a40', argent: '#c0c0c8', bleu: '#264653' }, desc: 'Un écran qui se déplie : téléphone et tablette en un.' },
  brique: { name: 'Nokio 3310 (la brique)', brand: 'Nokio', price: 300, cam: 0.6, lenses: 0, screen: 'retro', width: 300, radius: 36, retro: true, colors: { bleu: '#1d4e89', gris: '#7d8597', jaune: '#ffd60a' }, desc: 'Indestructible, écran vert rétro et jeu du serpent dans le cœur. Photos pixelisées.' },
};
export const DEFAULT_PHONE = { model: 'basique', color: 'noir', owned: ['basique'] };
export const phoneOf = (p) => {
  const m = p.phone && PHONES[p.phone.model] ? p.phone : DEFAULT_PHONE;
  const P = PHONES[m.model];
  return { ...m, P, hex: P.colors[m.color] || Object.values(P.colors)[0] };
};
export const PHONE_SHOPS = ['electronics', 'hightech'];
