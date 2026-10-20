// RECETTES À CUISINER CHEZ SOI (cuisinière posée dans son logement). Les ingrédients s'achètent au
// supermarché, à la supérette ou à la ferme. La réussite du plat (mini-jeu de cuisson) change ses effets :
// parfait = 100 %, correct = 75 %, raté = plat carbonisé (on le mange quand même... courageusement).

export const RECIPES = [
  { id: 'omelette', name: 'Omelette baveuse', emoji: '🍳', needs: { oeufs: 1 }, food: { faim: 35, energie: 10, humeur: 6 }, time: 1.0 },
  { id: 'salade', name: 'Salade du potager', emoji: '🥗', needs: { legumes: 1 }, food: { faim: 25, energie: 8, humeur: 8 }, time: 0.8, healthy: true },
  { id: 'soupe', name: 'Soupe de tomates', emoji: '🍅', needs: { tomates: 1, legumes: 1 }, food: { faim: 38, energie: 12, humeur: 8 }, time: 1.1, healthy: true },
  { id: 'pates-gratin', name: 'Gratin de pâtes', emoji: '🧀', needs: { pates: 1, 'fromage-rape': 1 }, food: { faim: 60, energie: 10, humeur: 16 }, time: 1.3 },
  { id: 'pates-legumes', name: 'Pâtes aux légumes', emoji: '🍝', needs: { pates: 1, legumes: 1 }, food: { faim: 55, energie: 12, humeur: 10 }, time: 1.2 },
  { id: 'crepes', name: 'Crêpes de Mamie Turbo', emoji: '🥞', needs: { farine: 1, oeufs: 1, lait: 1 }, food: { faim: 40, energie: 8, humeur: 22 }, time: 1.4 },
  { id: 'riz-cantonais', name: 'Riz cantonais', emoji: '🍚', needs: { riz: 1, oeufs: 1, legumes: 1 }, food: { faim: 62, energie: 15, humeur: 10 }, time: 1.3 },
  { id: 'burger-maison', name: 'Burger maison', emoji: '🍔', needs: { 'steak-hache': 1, tomates: 1, 'fromage-rape': 1 }, food: { faim: 68, energie: 12, humeur: 18 }, time: 1.5 },
  { id: 'omelette-legumes', name: 'Omelette aux légumes', emoji: '🥘', needs: { oeufs: 1, legumes: 1 }, food: { faim: 50, energie: 12, humeur: 8 }, time: 1.1, healthy: true },
];
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// Effets selon la qualité (0 = carbonisé, 0.75 = correct, 1 = parfait).
export function recipeEffect(r, quality) {
  if (quality <= 0.2) return { faim: Math.round(r.food.faim * 0.3), energie: 0, humeur: -10 };
  const k = quality >= 0.95 ? 1 : 0.75;
  return { faim: Math.round(r.food.faim * k), energie: Math.round(r.food.energie * k), humeur: Math.round(r.food.humeur * k + (k === 1 ? 4 : 0)) };
}

export const canCook = (r, inventory) => Object.entries(r.needs).every(([id, n]) => (inventory[id] || 0) >= n);
