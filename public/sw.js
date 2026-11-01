const SHELL_CACHE = "en-calma-shell-v4";
const RUNTIME_CACHE = "en-calma-runtime-v1";
const scope = self.registration.scope;
const apiPath = new URL("api/", scope).pathname;

function assetUrls(html) {
  const urls = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(([, value]) => new URL(value, scope).href);
  return [...new Set(urls)].filter(url => new URL(url).origin === self.location.origin);
}

async function storeShell(response) {
  if (!response.ok) return;
  const assets = assetUrls(await response.clone().text());
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(assets.map(async url => {
    if (!(await cache.match(url))) await cache.add(url);
  }));
  await cache.put(scope, response);
  const keep = new Set([scope, ...assets]);
  for (const request of await cache.keys()) {
    if (!keep.has(request.url)) await cache.delete(request);
  }
}

function offlineResponse() {
  return new Response("Sin conexión", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

// Responde con la copia guardada sin esperar a la red y actualiza la copia en segundo plano.
function serveShell(event) {
  const network = fetch(scope);
  event.waitUntil(network.then(response => storeShell(response.clone())).catch(() => {}));
  return caches.match(scope).then(cached => cached || network.catch(offlineResponse));
}

async function fromCacheOrNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    void caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("install", event => {
  event.waitUntil(fetch(scope).then(storeShell).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(apiPath)) return;

  if (request.mode === "navigate") {
    event.respondWith(serveShell(event));
    return;
  }

  event.respondWith(fromCacheOrNetwork(request));
});
