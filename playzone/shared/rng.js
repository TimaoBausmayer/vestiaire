// Générateur pseudo-aléatoire déterministe (mulberry32). Utilisé côté client ET serveur :
// avec la même graine, les deux calculent exactement les mêmes cibles, poulets, commandes...
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function pick(rand, arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }
export function range(rand, a, b) { return a + rand() * (b - a); }
export function randInt(rand, a, b) { return a + Math.floor(rand() * (b - a + 1)); }
export function shuffle(rand, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
