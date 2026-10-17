// ===== SERVICE WORKER =====
// Een klein hulpje van de browser dat ervoor zorgt dat je de app kunt installeren,
// en dat hij ook opent als je even geen internet hebt.
//
// Werkwijze: altijd eerst de nieuwste versie van internet halen ("network first"),
// zonder het eigen geheugen van de browser te gebruiken (cache: "no-cache").
// Lukt dat niet (geen internet), dan de laatst bewaarde versie gebruiken.

const CACHE = "mijn-overzicht-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  // Oude bewaarde versies weggooien
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(namen.filter(naam => naam !== CACHE).map(naam => caches.delete(naam))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const vraag = event.request;
  // Alleen onze eigen bestanden (niet Google of andere websites)
  if (vraag.method !== "GET" || new URL(vraag.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(vraag, { cache: "no-cache" })
      .then(antwoord => {
        const kopie = antwoord.clone();
        caches.open(CACHE).then(cache => cache.put(vraag, kopie));
        return antwoord;
      })
      .catch(() => caches.match(vraag, { ignoreSearch: true }))
  );
});
