// BESOINS DU PERSONNAGE (simulation de vie légère) : faim, énergie, humeur, sur 100.
// Ils baissent doucement pendant qu'on joue (pas quand on est déconnecté) et remontent en mangeant,
// en buvant, en dormant, en se douchant ou en s'amusant. Ils ne bloquent jamais le jeu : au pire,
// on marche un peu moins vite et le ventre gargouille.

export const NEED_KEYS = ['faim', 'energie', 'humeur', 'hygiene'];
// perte par minute de jeu
export const NEED_DECAY = { faim: 2.2, energie: 1.4, humeur: 0.9, hygiene: 0.6 };

export function defaultNeeds() { return { faim: 90, energie: 90, humeur: 80, hygiene: 90, at: 0 }; }

// Valeurs actuelles (calculées à partir du dernier enregistrement).
export function needsStatus(n, now) {
  const out = {};
  const mins = n.at ? Math.max(0, (now - n.at) / 60000) : 0;
  for (const k of NEED_KEYS) out[k] = Math.max(0, Math.min(100, (n[k] ?? 80) - NEED_DECAY[k] * mins));
  return out;
}

// Applique des changements (+/-) et ré-ancre le calcul à `now`.
export function applyNeeds(n, now, delta = {}) {
  const st = needsStatus(n, now);
  for (const k of NEED_KEYS) n[k] = Math.round(Math.max(0, Math.min(100, st[k] + (delta[k] || 0))) * 10) / 10;
  n.at = now;
  return n;
}

// Effets (doux) des besoins sur le personnage.
export function needsEffects(st) {
  return {
    speed: st.faim < 12 || st.energie < 10 ? 0.88 : 1,
    noSprint: st.energie < 6,
    hungry: st.faim < 20, tired: st.energie < 20, grumpy: st.humeur < 15, smelly: st.hygiene < 20,
  };
}
