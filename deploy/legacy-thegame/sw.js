// Replaces the offline worker of the old /thegame/ address. A browser that kept the old worker
// fetches this on its next update check: it drops what the old worker kept under /thegame/ (never
// the new /simulator/ copies, which share the cache names) and unregisters, so /thegame/ is plain
// redirects from then on. Open tabs are left alone: their game keeps running, and the next reload
// is redirected with the #g= save still in the address.
const OLD = '/thegame/';
const NEW = '/simulator/';

const moved = (href) => {
  const url = new URL(href);
  if (url.pathname.startsWith(OLD)) url.pathname = NEW + url.pathname.slice(OLD.length);
  return url.href;
};

async function forgetOldCopies() {
  for (const name of await caches.keys()) {
    if (!name.startsWith('hrs-')) continue;
    const cache = await caches.open(name);
    const requests = await cache.keys();
    let left = requests.length;
    for (const request of requests) {
      if (new URL(request.url).pathname.startsWith(OLD)) {
        await cache.delete(request);
        left--;
      }
    }
    if (left === 0) await caches.delete(name);
  }
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await forgetOldCopies();
    await self.registration.unregister();
  })());
});

// Until it is gone, a page load goes straight to the new address.
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') e.respondWith(Response.redirect(moved(e.request.url), 301));
});
