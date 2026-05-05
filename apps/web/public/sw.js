// YGE App service worker — minimal PWA cache.
//
// Plain English: makes the web app installable and gives it a small
// offline shell. Static assets (icons, fonts, JS bundles) are cached
// after first visit so a re-open works even with no internet. API
// calls always go to the network — we never serve stale business
// data. If the network is down, an API call returns a 503.
//
// Cache-busting: bump SW_VERSION whenever this file or its set of
// cached endpoints changes. The 'activate' handler purges old
// caches keyed by version.

const SW_VERSION = 'yge-pwa-v1';
const STATIC_CACHE = `yge-static-${SW_VERSION}`;
const STATIC_PRECACHE = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
];

// On install — pre-cache the icon set so a freshly installed PWA can
// render its launcher icon offline. Skip waiting so the new SW takes
// over immediately on next reload.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// On activate — purge any cache that does not belong to this SW
// version (older installs).
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('yge-') && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// On fetch — three policies:
//   1. Cross-origin requests (Microsoft Graph, Vercel domain quirks)
//      → never intercept; let them flow to network as-is.
//   2. /api/ → network-only (no stale business data).
//   3. Same-origin static assets → stale-while-revalidate so the
//      install shell still renders offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Stale-while-revalidate for static-ish GETs.
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      // Return cache immediately if we have it; otherwise wait on
      // the network. On total failure, return a small offline 503.
      return (
        cached ??
        (await fetched) ??
        new Response('Offline — try again when reconnected.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        })
      );
    }),
  );
});
