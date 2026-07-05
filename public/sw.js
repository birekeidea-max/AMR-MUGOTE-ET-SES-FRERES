const CACHE_NAME = "amr-mugote-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg"
];

// Installe le Service Worker et met en cache absolue les ressources initiales
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching critical assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Nettoie les anciens caches lors de l'activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie "Network First, Falling Back to Cache" pour garantir que l'utilisateur a toujours les données de vols en temps réel si connecté
self.addEventListener("fetch", (event) => {
  // Uniquement intercepter les requêtes GET locales (éviter d'intercepter les appels API Firebase/Firestore distants ou FlexPay qui nécessitent le réseau direct)
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Éviter d'intercepter les requêtes d'API locales qui doivent impérativement interroger le serveur en live (ex: check-status, chat, etc.)
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Enregistrer la nouvelle version dans le cache d'actifs statiques
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // En cas de panne de réseau (vitesse lente ou zone blanche sur le lac), servir depuis le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si rien d'arrière n'existe dans le cache, retourner un fallback
          const acceptHeader = event.request.headers.get("accept");
          if (acceptHeader && acceptHeader.includes("text/html")) {
            return caches.match("/");
          }
        });
      })
  );
});
