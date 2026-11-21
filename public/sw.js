// Service worker of the installable app (src/lib/serviceWorker.ts registers it,
// in production only). It keeps the app shell, never the data:
// - pages: network first; offline, the cached shell (index.html), whose
//   banner tells that a connection is required;
// - /assets/*: cache first (file names carry a hash, a file never changes);
// - anything else, other origins included (API, Auth0): not handled, never cached.
// Updates: a new worker takes over at once; pages come from the network, so the
// next page loaded is the new release, without stopping the user.

const SHELL_CACHE = 'sport-challenge-shell';
const ASSETS_CACHE = 'sport-challenge-assets';
const SHELL = '/';
// Old releases' files go first beyond this count (a cache lists its oldest first).
const MAX_ASSETS = 120;
// A file of /assets/ is the same whatever the request's headers: servers that
// answer "Vary: Origin" would otherwise miss the module scripts (sent with Origin).
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(SHELL)
      .then((response) => keepShell(response))
      // Unsteady network: the next page loaded keeps the shell instead.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(page(event));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(request));
  }
});

async function page(event) {
  try {
    const response = await fetch(event.request);
    event.waitUntil(keepShell(response.clone()));
    return response;
  } catch (error) {
    const shell = await caches.match(SHELL, { cacheName: SHELL_CACHE });
    if (shell) return shell;
    throw error;
  }
}

// Keeps index.html with the files it loads first: on the first visit they load
// before this worker controls the page, so they would not be cached otherwise.
// Every page is the same index.html: kept under one key, rebuilt without the
// address it came from, so an address (such as the sign-in code of /callback)
// is never stored.
async function keepShell(response) {
  if (!response.ok || !isHtml(response)) return;
  const html = await response.text();
  const files = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
  const assets = await caches.open(ASSETS_CACHE);
  const missing = [];
  for (const file of new Set(files)) {
    if (!(await assets.match(file, MATCH))) missing.push(file);
  }
  await assets.addAll(missing);
  // Last: the shell is only kept once it can start offline.
  const shell = await caches.open(SHELL_CACHE);
  const { status, statusText, headers } = response;
  await shell.put(SHELL, new Response(html, { status, statusText, headers }));
}

async function asset(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  // A file removed by a new release may come back as index.html (the host's
  // fallback for the app's addresses): never kept as that file.
  if (response.ok && !isHtml(response)) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, -MAX_ASSETS).map((key) => cache.delete(key)));
  }
  return response;
}

function isHtml(response) {
  return response.headers.get('content-type')?.includes('text/html') ?? false;
}
