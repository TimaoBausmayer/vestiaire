// Service worker minimal pour rendre Vestiaire installable ("Ajouter à l'écran d'accueil").
// Stratégie simple : on met en cache la coquille de l'appli (HTML/icônes) pour qu'elle s'ouvre
// même sans réseau, mais on privilégie toujours le réseau en premier pour avoir les dernières
// données à jour (l'appli dépend de Firestore en direct, donc pas de cache agressif des données).
const CACHE_NAME = "vestiaire-shell-v2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./app-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // "no-store" ici est indispensable : sans ça, fetch() respecte le Cache-Control (max-age=600)
  // envoyé par GitHub Pages et peut renvoyer une réponse du cache HTTP du navigateur sans même
  // recontacter le réseau — donc une appli installée peut rester bloquée sur une VIEILLE version
  // pendant 10 minutes (ou plus, sur un PWA installé) après chaque mise à jour. "no-store" force
  // une vraie requête réseau à chaque fois, ce qui est essentiel pour une appli dont le contenu
  // change souvent (corrections de bugs, nouvelles fonctionnalités).
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
