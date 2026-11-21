import { defineNetworkFixture, type NetworkFixture } from '@msw/playwright';
import { expect, test as base, type Page } from '@playwright/test';
import { handlers } from '../src/mocks/handlers';
import { AUTH0_DOMAIN, FAKE_SIGN_IN, fakeAuth0 } from './fakeAuth0';

/**
 * The date of every test, as the page's clock shows it: Thursday
 * 19 November 2026, noon in Montréal. The mocks are written for it
 * (ongoing challenges in week 3, activities up to that morning).
 */
export const NOW = new Date('2026-11-19T17:00:00Z');

interface Fixtures {
  /** The mocked API and Auth0 tenant; `network.use` overrides a route for one test. */
  network: NetworkFixture;
}

export const test = base.extend<Fixtures>({
  network: [
    async ({ context, baseURL }, use) => {
      if (!baseURL) throw new Error('baseURL is missing from playwright.config.ts');
      const network = defineNetworkFixture({
        context,
        handlers: [...fakeAuth0(new URL(baseURL).origin, NOW), ...handlers],
        // The app's own files come from the development server.
        onUnhandledFrame: 'bypass',
      });
      await network.enable();
      await use(network);
      await network.disable();
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(NOW);
    await use(page);
  },
});

export { expect };

/**
 * Opens `path` signed out: the app sends the user to the sign-in page, then
 * back to `path` once signed in.
 */
export async function signInAt(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.getByRole('link', { name: FAKE_SIGN_IN }).click();
  await page.waitForURL((url) => url.host !== AUTH0_DOMAIN && url.pathname !== '/callback');
}
