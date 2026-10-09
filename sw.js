// Service worker de Vestiaire : permet d'utiliser l'appli HORS LIGNE.
// - La coquille (HTML, icônes) ET les modules Firebase (gstatic) sont mis en cache, y compris leurs
//   sous-modules, pour que l'appli démarre sans réseau.
// - Réseau d'abord (toujours la dernière version quand on est en ligne, "no-store" pour éviter le cache
//   HTTP de GitHub Pages), avec un délai maximum : si le réseau est absent ou trop lent, on sert le cache.
// - Les données (Firestore) sont gardées sur l'appareil par Firestore lui-même (cache persistant) et les
//   modifications faites hors ligne sont envoyées toutes seules au retour du réseau.
const CACHE_NAME = "vestiaire-shell-v3";
const SHELL_FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./app-logo.png"];
const FIREBASE_ROOT = [
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js",
];
const NET_TIMEOUT = 4000;

// Télécharge un module JS et tous ses imports relatifs (récursivement) pour les mettre en cache.
async function cacheModuleTree(cache, url, seen){
  if(seen.has(url)) return; seen.add(url);
  try{
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) return;
    await cache.put(url, res.clone());
    const txt = await res.text();
    const re = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g; let m; const subs = [];
    while((m = re.exec(txt))) subs.push(new URL(m[1], url).href);
    await Promise.all(subs.map(u=>cacheModuleTree(cache, u, seen)));
  }catch(e){}
}

self.addEventListener("install", (event) => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_FILES.map(f=>cache.add(f).catch(()=>{})));
    const seen = new Set();
    await Promise.all(FIREBASE_ROOT.map(u=>cacheModuleTree(cache, u, seen)));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

function fetchWithTimeout(req){
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>reject(new Error("timeout")), NET_TIMEOUT);
    fetch(req, {cache:"no-store"}).then(r=>{ clearTimeout(t); resolve(r); }, e=>{ clearTimeout(t); reject(e); });
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFirebaseModule = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if(!sameOrigin && !isFirebaseModule) return; // Firestore (WebChannel), Wikipédia, etc. : on ne touche pas
  event.respondWith((async()=>{
    try{
      const res = await fetchWithTimeout(req);
      if(res && res.ok){ const copy = res.clone(); caches.open(CACHE_NAME).then(c=>c.put(req, copy)).catch(()=>{}); }
      return res;
    }catch(e){
      const cached = await caches.match(req, {ignoreSearch:true});
      if(cached) return cached;
      if(req.mode === "navigate"){ const shell = await caches.match("./index.html"); if(shell) return shell; }
      return new Response("", {status:504, statusText:"Hors ligne"});
    }
  })());
});
