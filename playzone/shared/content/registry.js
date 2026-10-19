// Registre de contenu : fusionne les packs (base + saisons + mises à jour mensuelles).
// Pour ajouter du contenu : créer un fichier dans packs/ et l'ajouter à PACKS. Un pack peut avoir des
// dates (start/end) : il s'active et se désactive tout seul, côté client comme côté serveur.
import base from './packs/base.js';
import halloween2026 from './packs/halloween-2026.js';
import ville from './packs/city.js';
import { JOBS, JOB_BY_ID } from './jobs.js';
import { SPECIES } from './animals.js';
import { BASE_EVENTS } from './events.js';

export const PACKS = [base, ville, halloween2026];

export function isPackActive(pack, now) {
  if (!pack.start) return true;
  return now >= Date.parse(pack.start) && now < Date.parse(pack.end);
}

export function buildContent(now = Date.now(), packs = PACKS) {
  const items = {}, minigames = {}, events = {};
  const decorations = [], npcLines = [], active = [];
  for (const ev of BASE_EVENTS) events[ev.id] = { ...ev, pack: 'base' };
  for (const p of packs) {
    const on = isPackActive(p, now);
    if (on) active.push(p);
    // Les objets de tous les packs restent connus (on garde ce qu'on a acheté), mais seuls ceux
    // des packs actifs sont en vente.
    for (const it of p.items || []) items[it.id] = { ...it, pack: p.id, seasonal: !!p.start, available: on };
    if (!on) continue;
    for (const mg of p.minigames || []) minigames[mg.id] = { ...mg, pack: p.id };
    for (const ev of p.events || []) events[ev.id] = { ...ev, pack: p.id, seasonal: !!p.start };
    decorations.push(...(p.decorations || []));
    npcLines.push(...(p.npcLines || []));
  }
  return { now, packs: active, allPacks: packs, items, minigames, events, jobs: JOB_BY_ID, jobList: JOBS, species: SPECIES, decorations, npcLines };
}
