// Règles d'économie et de progression (pures, partagées client/serveur).
import { isClean } from './chat-filter.js';

export const START_COINS = 200;
export const MAX_COINS = 10_000_000;
export const MAX_LEVEL = 30;
export const DAILY = { base: 50, perStreak: 15, max: 140 };
export const MAX_PETS = 3;
export const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _'-]{3,16}$/;

// XP nécessaire pour atteindre le niveau n (niveau 1 = 0 XP).
export function xpForLevel(n) { return Math.round(80 * Math.pow(n - 1, 1.55)); }
export function levelFromXp(xp) {
  let lv = 1;
  while (lv < MAX_LEVEL && xp >= xpForLevel(lv + 1)) lv++;
  return lv;
}
export function levelProgress(xp) {
  const lv = levelFromXp(xp);
  if (lv >= MAX_LEVEL) return { level: lv, cur: 1, next: 1, ratio: 1 };
  const a = xpForLevel(lv), b = xpForLevel(lv + 1);
  return { level: lv, cur: xp - a, next: b - a, ratio: (xp - a) / (b - a) };
}

export function validName(name) {
  if (typeof name !== 'string') return 'Nom invalide.';
  const n = name.trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(n)) return 'Le nom doit faire 3 à 16 caractères (lettres, chiffres, espaces, - et _).';
  if (!isClean(n)) return 'Ce nom n\'est pas autorisé.';
  return null;
}

// Rendements décroissants : on garde l'heure des dernières récompenses par activité.
// Les 6 premières de l'heure rapportent 100 %, puis 60 %, puis 30 % (pour éviter le "farm" en boucle).
export function activityFactor(profile, key, now) {
  const list = (profile.activity[key] || []).filter((t) => now - t < 3600_000);
  profile.activity[key] = list;
  const n = list.length;
  return n < 6 ? 1 : n < 12 ? 0.6 : 0.3;
}
export function recordActivity(profile, key, now) {
  (profile.activity[key] ||= []).push(now);
  if (profile.activity[key].length > 40) profile.activity[key].shift();
}

export function minigameReward(def, score, kind = def.kind) {
  if (kind === 'time') {
    const r = def.reward;
    let pc = r.finish_pc, medal = null;
    if (score <= r.gold) { pc = r.gold_pc; medal = 'or'; } else if (score <= r.silver) { pc = r.silver_pc; medal = 'argent'; } else if (score <= r.bronze) { pc = r.bronze_pc; medal = 'bronze'; }
    return { coins: pc, xp: def.xp.base + (medal === 'or' ? 25 : medal === 'argent' ? 15 : medal === 'bronze' ? 8 : 0), medal };
  }
  const s = Math.max(0, score);
  return {
    coins: Math.min(def.reward.cap, def.reward.base + s * def.reward.per),
    xp: Math.min(def.xp.cap, def.xp.base + s * def.xp.per),
    medal: null,
  };
}

export function todayKey(now) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
