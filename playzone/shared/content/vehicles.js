// Catalogue des véhicules : apparence (gabarit), conduite et prix. Partagé client/serveur :
// le serveur s'en sert pour vérifier la vitesse maximale réelle de chaque véhicule.
// max : vitesse max (m/s) · acc : accélération (m/s²) · turn : braquage · grip : adhérence (0-1)
// fuel : réservoir (L) · use : consommation (L / km) · seats : places
export const VEHICLE_CATS = {
  micro: 'Petits véhicules', citadine: 'Citadines', berline: 'Berlines', sport: 'Sportives', suv: 'SUV et 4x4',
  utilitaire: 'Utilitaires', moto: 'Deux-roues', service: 'Véhicules de service',
};

export const VEHICLES = {
  // --- petits véhicules (déjà dans le jeu)
  trottinette: { name: 'Trottinette', cat: 'micro', kind: 'board', max: 9.5, acc: 7, turn: 2.6, grip: 0.95, fuel: 0, price: 450, seats: 1 },
  caddie: { name: 'Caddie Turbo', cat: 'micro', kind: 'caddie', max: 12, acc: 8, turn: 2.8, grip: 0.8, fuel: 0, price: 1200, level: 2, seats: 1 },
  velo: { name: 'Vélo de Ville', cat: 'moto', kind: 'bike', max: 11, acc: 6, turn: 2.6, grip: 0.95, fuel: 0, price: 450, seats: 1 },
  scooter: { name: 'Scooter', cat: 'moto', kind: 'scooter', max: 16, acc: 9, turn: 2.4, grip: 0.92, fuel: 6, use: 0.03, price: 2400, level: 3, seats: 1 },
  moto: { name: 'Moto Éclair 600', cat: 'moto', kind: 'moto', max: 30, acc: 15, turn: 2.2, grip: 0.9, fuel: 14, use: 0.05, price: 9500, level: 6, seats: 1 },
  // --- voitures
  voiturette: { name: 'Voiturette Bulle', cat: 'citadine', kind: 'car', body: 'micro', max: 18.5, acc: 10, turn: 2.0, grip: 0.9, fuel: 25, use: 0.04, price: 9000, level: 5, seats: 2 },
  citadine: { name: 'Pomme 3 portes', cat: 'citadine', kind: 'car', body: 'hatch', max: 23, acc: 10.5, turn: 1.9, grip: 0.9, fuel: 40, use: 0.05, price: 14500, level: 5, seats: 4 },
  berline: { name: 'Familiale Confort', cat: 'berline', kind: 'car', body: 'sedan', max: 26, acc: 10.5, turn: 1.75, grip: 0.9, fuel: 55, use: 0.06, price: 26000, level: 7, seats: 5 },
  break: { name: 'Familiale Break', cat: 'berline', kind: 'car', body: 'wagon', max: 25, acc: 10, turn: 1.75, grip: 0.9, fuel: 55, use: 0.06, price: 28000, level: 7, seats: 5 },
  sportive: { name: 'Fusée GT', cat: 'sport', kind: 'car', body: 'sport', max: 34, acc: 17, turn: 1.85, grip: 0.95, fuel: 60, use: 0.1, price: 89000, level: 12, seats: 2 },
  coupe: { name: 'Coupé Riviera', cat: 'sport', kind: 'car', body: 'coupe', max: 30, acc: 14, turn: 1.85, grip: 0.93, fuel: 55, use: 0.08, price: 52000, level: 10, seats: 2 },
  suv: { name: 'Mammouth 4x4', cat: 'suv', kind: 'car', body: 'suv', max: 25, acc: 11, turn: 1.6, grip: 0.92, fuel: 70, use: 0.09, price: 39000, level: 8, seats: 5 },
  pickup: { name: 'Bûcheron Pick-up', cat: 'suv', kind: 'car', body: 'pickup', max: 24, acc: 10, turn: 1.55, grip: 0.88, fuel: 75, use: 0.1, price: 35000, level: 8, seats: 2 },
  fourgon: { name: 'Fourgon Pratique', cat: 'utilitaire', kind: 'car', body: 'van', max: 21, acc: 8, turn: 1.5, grip: 0.86, fuel: 70, use: 0.09, price: 24000, level: 6, seats: 3 },
  camion: { name: 'Malle-Poste (camionnette)', cat: 'utilitaire', kind: 'car', body: 'box', max: 19, acc: 7, turn: 1.4, grip: 0.85, fuel: 90, use: 0.12, price: 32000, level: 8, seats: 2 },
  // --- véhicules de service (conduits par les PNJ ; certains volables...)
  taxi: { name: 'Taxi', cat: 'service', kind: 'car', body: 'sedan', livery: 'taxi', paint: '#ffd23f', max: 25, acc: 10, turn: 1.75, grip: 0.9, fuel: 55, use: 0.06, price: 0, seats: 5 },
  police: { name: 'Voiture de police', cat: 'service', kind: 'car', body: 'sedan', livery: 'police', paint: '#f4f4f4', siren: true, max: 33, acc: 15, turn: 1.9, grip: 0.95, fuel: 60, use: 0.08, price: 0, seats: 4 },
  ambulance: { name: 'Ambulance', cat: 'service', kind: 'car', body: 'van', livery: 'ambulance', paint: '#f7f7f2', siren: true, max: 26, acc: 10, turn: 1.55, grip: 0.88, fuel: 80, use: 0.1, price: 0, seats: 3 },
  pompiers: { name: 'Camion de pompiers', cat: 'service', kind: 'car', body: 'box', livery: 'fire', paint: '#d62828', siren: true, max: 22, acc: 8, turn: 1.35, grip: 0.86, fuel: 120, use: 0.15, price: 0, seats: 3 },
  bus: { name: 'Bus', cat: 'service', kind: 'car', body: 'bus', max: 17, acc: 6, turn: 1.15, grip: 0.85, fuel: 150, use: 0.2, price: 0, seats: 30 },
  glace: { name: 'Camion de glaces', cat: 'service', kind: 'car', body: 'box', livery: 'icecream', paint: '#ffc8dd', max: 18, acc: 7, turn: 1.4, grip: 0.85, fuel: 80, use: 0.1, price: 0, seats: 2 },
  depanneuse: { name: 'Dépanneuse', cat: 'service', kind: 'car', body: 'pickup', livery: 'tow', paint: '#ff9f1c', max: 22, acc: 9, turn: 1.5, grip: 0.88, fuel: 90, use: 0.1, price: 0, seats: 2 },
};

export const VEHICLE_IDS = Object.keys(VEHICLES);
// Modèles qu'on croise dans la circulation (avec leur fréquence relative)
export const TRAFFIC_MIX = [['citadine', 6], ['berline', 5], ['break', 3], ['suv', 3], ['pickup', 2], ['fourgon', 2], ['camion', 1], ['taxi', 2], ['sportive', 1], ['coupe', 1], ['voiturette', 1], ['bus', 1], ['glace', 0.5], ['police', 1.5], ['ambulance', 0.4], ['depanneuse', 0.4], ['moto', 1], ['scooter', 1]];

// Vitesse max autorisée par le serveur pour un véhicule (marge comprise).
export function maxSpeedOf(model) { return (VEHICLES[model]?.max ?? 20) * 1.12 + 2; }

export const CAR_PAINTS = ['#e63946', '#f4f1ea', '#1d3557', '#2b2d42', '#a8dadc', '#457b9d', '#ffb703', '#fb8500', '#2a9d8f', '#8338ec', '#606c38', '#bc6c25', '#d90429', '#c0c0c8', '#ff70a6', '#0b090a'];
