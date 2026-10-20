// CORPS ET SANTÉ : barre de santé, blessures (entorse, fracture...), poids et muscles qui évoluent selon
// ce qu'on mange et le sport, âge (qu'on peut figer ou choisir à la clinique), attirance (vêtements,
// parfum, coiffure, propreté, forme...). Tout évolue pendant le temps de jeu seulement.

export const AGE_MINUTES = 360;     // 6 heures de jeu = 1 an
export const IDEAL_WEIGHT = 72;
export function defaultBody() {
  return { health: 100, weight: IDEAL_WEIGHT, muscle: 15, age: 20, ageMins: 0, ageFrozen: false, injury: null, perfumeUntil: 0, haircutAt: 0, gymUntil: 0, shirtless: false, hospitalAt: 0 };
}

export const INJURIES = {
  bosse: { name: 'Grosse bosse', speed: 0.92, minutes: 8, care: 60, health: 10 },
  entorse: { name: 'Entorse de la cheville', speed: 0.72, minutes: 25, care: 150, health: 18, noSprint: true },
  fracture: { name: 'Fracture du bras', speed: 0.62, minutes: 70, care: 480, health: 35, noSprint: true, noJump: true },
  commotion: { name: 'Commotion', speed: 0.8, minutes: 30, care: 250, health: 28 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Évolution pendant `mins` minutes de jeu (st = besoins actuels).
export function bodyTick(b, st, mins, now) {
  if (st.faim < 8 || st.energie < 5) b.health -= 0.6 * mins;
  else if (st.faim > 35 && st.energie > 25) b.health += 0.35 * mins;
  if (st.faim < 15) { b.weight -= 0.1 * mins; b.muscle -= 0.06 * mins; }     // trop peu manger : on maigrit, on s'affaiblit
  b.muscle -= 0.008 * mins;                                                  // sans entraînement, ça fond doucement
  if (b.injury && now >= b.injury.until) b.injury = null;                    // guérison naturelle
  const cap = b.injury ? 100 - INJURIES[b.injury.kind].health : 100;
  b.health = clamp(b.health, 0, cap);
  b.weight = clamp(b.weight, 45, 150);
  b.muscle = clamp(b.muscle, 3, 100);
  if (!b.ageFrozen) { b.ageMins += mins; while (b.ageMins >= AGE_MINUTES) { b.age++; b.ageMins -= AGE_MINUTES; } }
  b.age = clamp(b.age, 16, 99);
  return b;
}

// Manger alors qu'on n'a plus faim fait grossir.
export function eatWeight(b, faimBefore, food) {
  if (faimBefore > 85 && (food.faim || 0) > 8) b.weight = clamp(b.weight + 0.3 * ((food.faim || 0) / 40), 45, 150);
}

// Effets sur le personnage.
export function bodyEffects(b) {
  const inj = b.injury ? INJURIES[b.injury.kind] : null;
  const over = Math.max(0, b.weight - 95), under = Math.max(0, 58 - b.weight);
  let speed = (inj?.speed || 1) * (1 + Math.min(0.12, b.muscle * 0.0012)) * (1 - Math.min(0.2, over * 0.006)) * (1 - Math.min(0.12, under * 0.012));
  if (b.health < 25) speed *= 0.85;
  if (b.age > 65) speed *= 0.92;
  return {
    speed, noSprint: !!inj?.noSprint || b.health < 10, noJump: !!inj?.noJump,
    jump: 1 + Math.min(0.1, b.muscle * 0.001) - Math.min(0.15, over * 0.004),
    fat: clamp((b.weight - IDEAL_WEIGHT) / 50, -0.4, 1), strong: clamp(b.muscle / 100, 0, 1),
  };
}

// Attirance (0 à 100) : ce qu'on porte, le parfum, la coiffure, la propreté, la forme, la réputation.
export function attractiveness(p, items, now, hygiene = 80) {
  const b = p.body, a = p.appearance;
  let worn = 0;
  for (const slot of ['hat', 'glasses', 'top', 'bottom', 'back', 'feet']) { const it = items[a[slot]]; if (it?.price) worn += it.price; }
  const parts = {
    base: 25,
    style: Math.min(25, Math.log2(1 + worn / 40) * 3.5),
    parfum: now < (b.perfumeUntil || 0) ? 12 : 0,
    coiffure: now - (b.haircutAt || 0) < 3 * 3600_000 ? 8 : 0,
    proprete: hygiene < 30 ? -20 : hygiene > 80 ? 5 : 0,
    muscles: Math.min(15, b.muscle * 0.17),
    silhouette: -Math.min(15, Math.max(0, Math.abs(b.weight - IDEAL_WEIGHT) - 15) * 0.6),
    sante: b.health < 40 ? -10 : 0,
    reputation: Math.min(10, (p.rep || 0) / 50),
  };
  const total = Math.round(clamp(Object.values(parts).reduce((s, v) => s + v, 0), 0, 100));
  return { total, parts };
}

// Salle de sport : abonnements (durée réelle) et machines (gains par minute).
export const GYM_PASSES = { jour: { name: 'Pass journée', price: 60, ms: 4 * 3600_000 }, semaine: { name: 'Abonnement semaine', price: 300, ms: 28 * 3600_000 }, mois: { name: 'Abonnement mois', price: 900, ms: 120 * 3600_000 } };
export const MACHINES = {
  tapis: { name: 'Tapis de course', emoji: '🏃', muscle: 0.12, weight: -0.14, energie: -3, hygiene: -2.5, faim: -1.5 },
  banc: { name: 'Banc de musculation', emoji: '🏋️', muscle: 0.32, weight: -0.04, energie: -4, hygiene: -2, faim: -1.5 },
  velo: { name: 'Vélo d\'appartement', emoji: '🚴', muscle: 0.1, weight: -0.16, energie: -3, hygiene: -2.5, faim: -1.5 },
};
export const MACHINE_MAX_MIN = 10;
// Pompes : appuis sur Espace pour une pompe (moins quand on est musclé).
export const tapsPerPushup = (muscle) => Math.max(3, 10 - Math.floor(muscle / 12));
export const PUSHUP_GAIN = { muscle: 0.05, weight: -0.01, energie: -0.35 };

// Clinique : figer son âge, choisir son âge.
export const CLINIC = { freeze: 50_000, choose: 20_000 };
export const HAIR_PRICES = { coupe: 35, couleur: 55, both: 80 };
