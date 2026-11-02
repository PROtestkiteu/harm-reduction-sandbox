import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * The version shown in the corner: major and minor from package.json, the
 * last digit the number of commits that touched this app, so every commit on
 * GitHub main moves it on by one. Without git (a zip download) package.json
 * alone decides.
 */
function appVersion(): string {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
  try {
    const count = execSync('git rev-list --count HEAD -- .', { cwd: new URL('.', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const [major, minor] = version.split('.');
    return /^\d+$/.test(count) ? `${major}.${minor}.${count}` : version;
  } catch {
    return version;
  }
}

/** One id per build: a running game compares it with version.json to notice a newer one. */
const BUILD = `${appVersion()}+${Date.now().toString(36)}`;

/** Writes version.json next to the page, read by running games (src/game/updates.ts). */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
    },
  };
}

/**
 * Writes sw.js: the offline worker (registered in src/loading.ts). It keeps this build's files on
 * the phone, so an installed game starts offline and, on a slow connection, without waiting for
 * the network: the page is asked for first (a few seconds at most, then the kept copy), every
 * hashed file comes from the cache, and the people and city models are kept the first time they
 * load. Saves, the leaderboard and the update check always go to the network. A new build is a
 * new cache; the old one is dropped once the new worker takes over.
 */
function offlineWorker(): Plugin {
  return {
    name: 'offline-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Old .woff fonts are only for browsers that cannot run the game anyway (they all take .woff2).
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff') && f !== 'version.json' && f !== 'index.html');
      const portraits = readdirSync(new URL('./public/portraits/dusk-v3/', import.meta.url)).filter((f) => f.endsWith('.webp')).map((f) => `portraits/dusk-v3/${f}`);
      const keep = ['./', ...files, ...portraits, 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'protest-logo.webp'];
      const source = `const BUILD = ${JSON.stringify(BUILD)};
const CACHE = 'hrs-' + BUILD;
const MODELS = 'hrs-models';
const KEEP = ${JSON.stringify(keep)};
const PAGE_WAIT_MS = 3500;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(KEEP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hrs-') && k !== CACHE && k !== MODELS).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/** The page: the network first, the kept copy if it is slow or offline; a fresh page replaces the copy. */
async function page(request) {
  const cache = await caches.open(CACHE);
  const fresh = fetch(request).then((res) => {
    if (res.ok) cache.put('./', res.clone());
    return res;
  });
  fresh.catch(() => { /* offline: handled below */ });
  const slow = new Promise((resolve) => setTimeout(resolve, PAGE_WAIT_MS));
  try {
    const first = await Promise.race([fresh, slow]);
    if (first) return first;
  } catch { /* offline: the kept copy */ }
  return (await cache.match('./')) || fresh;
}

/** Any other file: the cache, else the network (models are kept once they load). */
async function file(request, url) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && /\\.(glb|png|webp|jpg)$/.test(url.pathname)) (await caches.open(MODELS)).put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const request = e.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.endsWith('version.json') || url.pathname.endsWith('sw.js')) return;
  e.respondWith(request.mode === 'navigate' ? page(request) : file(request, url));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()), __APP_BUILD__: JSON.stringify(BUILD) },
  plugins: [versionFile(), offlineWorker()],
  // In development the leaderboard runs on PHP's built-in server (server/board.php on port 5203).
  server: { port: 5199, strictPort: true, proxy: { '/api/board.php': { target: 'http://127.0.0.1:5203', rewrite: (path) => path.replace(/^\/api\/board\.php/, '/board.php') } } },
  preview: { port: 5199, strictPort: true },
  build: { target: 'es2022', outDir: 'dist' },
});
