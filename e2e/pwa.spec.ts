import type { Page } from '@playwright/test';
import { AUTH0_DOMAIN, FAKE_SIGN_IN } from './fakeAuth0';
import { expect, signInAt, test } from './fixtures';

// The service worker of the installable app (public/sw.js), on a production
// build (project "pwa" of playwright.config.ts): it keeps the app shell to
// start offline, never the data.

// The name of the shell's cache in public/sw.js: keep them the same.
const SHELL_CACHE = 'sport-challenge-shell';

/** Once the worker controls the page and kept the shell, as after a first visit. */
async function firstVisit(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect
    .poll(() =>
      page.evaluate(
        async (name) => Boolean(await (await caches.open(name)).match('/')),
        SHELL_CACHE,
      ),
    )
    .toBe(true);
}

/** Every address kept in the caches of the page's origin. */
function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
}

test('starts offline after a first visit, says a connection is required, and waits to sign in', async ({
  page,
  context,
}) => {
  await firstVisit(page);
  // Every request to the sign-in service, offline or back online.
  const signIns: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).host === AUTH0_DOMAIN) signIns.push(request.url());
  });

  await context.setOffline(true);
  await page.goto('/challenges');

  const banner = page.getByText('Tu es hors ligne : une connexion internet est nécessaire.');
  await expect(banner).toBeVisible();
  await expect(
    page.getByText('Tu pourras te connecter dès que tu seras de nouveau en ligne.'),
  ).toBeVisible();
  // No sign-in started: nothing asked of the sign-in service, the page stays the app's.
  expect(signIns).toEqual([]);
  expect(new URL(page.url()).pathname).toBe('/challenges');

  // Back online, the banner goes and the sign-in starts.
  await context.setOffline(false);
  await expect(banner).toBeHidden();
  await expect(page.getByRole('link', { name: FAKE_SIGN_IN })).toBeVisible();
  expect(signIns.length).toBeGreaterThan(0);
});

test('keeps only the shell and the files of /assets/, never the data nor an address', async ({
  page,
}) => {
  await firstVisit(page);
  // The sign-in comes back through /callback?code=…, then loads data from the API.
  const pages: URL[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) pages.push(new URL(frame.url()));
  });
  await signInAt(page, '/challenges');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(pages.some((url) => url.pathname === '/callback' && url.searchParams.has('code'))).toBe(
    true,
  );

  const urls = (await cachedUrls(page)).map((url) => new URL(url));
  const origin = new URL(page.url()).origin;
  expect(urls.length).toBeGreaterThan(1);
  for (const url of urls) {
    expect(url.origin).toBe(origin);
    expect(url.search).toBe('');
    expect(url.pathname === '/' || url.pathname.startsWith('/assets/')).toBe(true);
  }
});

test('does not keep a page answered for a file of /assets/ that a release removed', async ({
  page,
}) => {
  await firstVisit(page);
  const removed = '/assets/removed-0123abcd.js';

  // The host answers its index.html for an address it does not have.
  const type = await page.evaluate(
    async (path) => (await fetch(path)).headers.get('content-type'),
    removed,
  );
  expect(type).toContain('text/html');

  // In no cache.
  const kept = (await cachedUrls(page)).map((url) => new URL(url).pathname);
  expect(kept).not.toContain(removed);
  expect(kept.some((path) => path.startsWith('/assets/'))).toBe(true);
});
