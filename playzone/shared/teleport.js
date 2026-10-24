// TÉLÉPORTATION (téléphone, carte) : n'importe où sur la carte, mais ça coûte cher ; gratuit pour l'admin.
export const TELEPORT = { base: 400, perKm: 350, max: 4000 };
export const teleportCost = (from, to) => Math.min(TELEPORT.max, Math.round(TELEPORT.base + (from ? Math.hypot(to.x - from.x, to.z - from.z) / 1000 : 1) * TELEPORT.perKm));
