// ===== SERVICE WORKER =====
// Een klein hulpje van de browser dat ervoor zorgt dat je de app kunt installeren,
// en dat hij ook opent als je even geen internet hebt.
//
// Werkwijze: eerst altijd de nieuwste versie van internet halen ("network first").
// Lukt dat niet (geen internet), dan de laatst bewaarde versie gebruiken.

const CACHE = "mijn-overzicht";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const vraag = event.request;
  // Alleen onze eigen bestanden (niet Google of andere websites)
  if (vraag.method !== "GET" || new URL(vraag.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(vraag)
      .then(antwoord => {
        const kopie = antwoord.clone();
        caches.open(CACHE).then(cache => cache.put(vraag, kopie));
        return antwoord;
      })
      .catch(() => caches.match(vraag, { ignoreSearch: true }))
  );
});
