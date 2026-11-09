// PROFIL D'ATHLÈTE : vitesse et endurance du corps progressent quand on court (partout en ville, et
// encore plus en compétition). On choisit sa spécialité : sprinteur·euse (plus rapide, moins de
// souffle), endurance (tient beaucoup plus longtemps, un peu moins vif) ou polyvalent·e.
// Ces qualités servent dans tous les sports liés : foot, tennis, natation, boxe, courses...

export const PROFILS = {
  polyvalent: { name: 'Polyvalent·e', icon: '⚖️', desc: 'Équilibré : progresse partout de façon égale.', top: 1, stamina: 1, gV: 1, gE: 1 },
  sprinteur: { name: 'Sprinteur·euse', icon: '⚡', desc: 'Pointe de vitesse +6 %, souffle −15 %. La vitesse progresse 1,6× plus vite. Idéal pour le 100 m et le foot.', top: 1.06, stamina: 0.85, gV: 1.6, gE: 0.7 },
  endurance: { name: 'Endurance', icon: '🫁', desc: 'Souffle +40 %, moins de fatigue sur les longues courses, pointe −4 %. L\'endurance progresse 1,6× plus vite. Idéal pour semi et marathon.', top: 0.96, stamina: 1.4, gV: 0.6, gE: 1.6 },
};
export const profilOf = (b) => PROFILS[b?.profil] || PROFILS.polyvalent;
export const vitesseOf = (b) => b?.vitesse ?? 10;

// Vitesse de pointe en sprint (multiplicateur de la course du personnage)
export const sprintFactor = (b) => (0.82 + (b?.muscle ?? 15) / 220 + vitesseOf(b) / 380) * profilOf(b).top;
// Durée du souffle en sprint (secondes de sprint à fond avant d'être essoufflé·e)
export const staminaSecs = (b) => (6 + (b?.muscle ?? 15) * 0.1 + (b?.endurance ?? 15) * 0.18) * profilOf(b).stamina;

// Gains d'un footing / d'une course en ville (mètres réellement courus, sprint compté double)
export const RUN_CAP = 600;   // mètres max par envoi
export function runGain(b, meters) {
  const P = profilOf(b), k = Math.max(0, Math.min(RUN_CAP, meters)) / 1000;
  return {
    endurance: k * 0.9 * P.gE * (1 - (b?.endurance ?? 15) / 125),
    vitesse: k * 0.6 * P.gV * (1 - vitesseOf(b) / 125),
  };
}

// Gains d'une épreuve de course (selon la distance : le sprint fait la vitesse, le long l'endurance)
export function raceGain(b, kind) {
  const P = profilOf(b);
  const base = { sprint: { v: 1.6, e: 0.3 }, piste: { v: 0.8, e: 1.2 }, long: { v: 0.4, e: 3 }, marathon: { v: 0.5, e: 4.5 } }[kind] || { v: 0.6, e: 1.5 };
  return { vitesse: base.v * P.gV * (1 - vitesseOf(b) / 125), endurance: base.e * P.gE * (1 - (b?.endurance ?? 15) / 125) };
}

// Fatigue sur les longues courses : capacité (en mètres « à allure normale ») selon l'endurance
export const fatigueCapacity = (b, len) => len * (0.45 + (b?.endurance ?? 15) / 100 * 1.25) * (profilOf(b).stamina > 1 ? 1.35 : profilOf(b).stamina < 1 ? 0.85 : 1);
