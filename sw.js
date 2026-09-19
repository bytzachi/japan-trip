/* Offline support: keeps the page and the (encrypted) ticket files available without internet. */
const VER = 'jt-v1';
const CORE = ['./', 'index.html'];
const VAULT = ['vault/data.enc', 'vault/p1.enc', 'vault/p2.enc', 'vault/p3.enc', 'vault/p4.enc'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VER)
      .then((c) => Promise.all(CORE.concat(VAULT).map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.indexOf('/vault/') !== -1) {
    // ticket files: serve the saved copy instantly, refresh it in the background
    e.respondWith((async () => {
      const c = await caches.open(VER);
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || Response.error();
    })());
    return;
  }

  // page and other same-origin files: newest version when online, saved copy when offline
  e.respondWith(
    fetch(req)
      .then((r) => { if (r.ok) { const cp = r.clone(); caches.open(VER).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((h) => h || caches.match('index.html')))
  );
});
