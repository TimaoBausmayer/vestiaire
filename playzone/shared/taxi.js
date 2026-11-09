// TAXI : trajet immédiat vers un lieu de la carte, prix selon la distance (gratuit pour l'admin).
export const taxiPrice = (dist) => Math.round(15 + Math.max(0, dist) * 0.035);
