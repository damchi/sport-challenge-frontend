import { defineConfig, devices } from '@playwright/test';
import { API_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN } from './e2e/fakeAuth0';

// End-to-end journeys against the development server, with the API and
// Auth0 mocked in the test run (e2e/fixtures.ts): no real service is called.
// The service worker runs in production builds only: its journeys
// (e2e/pwa.spec.ts) get a production build, served by `vite preview`.
const PORT = 5180;
const baseURL = `http://localhost:${PORT}`;
const PWA_PORT = 4180;
const PWA_DIST = 'node_modules/.e2e-dist';
const PWA_SPEC = /pwa\.spec\.ts/;
const CI = process.env.CI === 'true';

// Public test values only; they win over the .env files.
const env = {
  VITE_API_URL: 'https://api.e2e.test',
  VITE_AUTH0_DOMAIN: AUTH0_DOMAIN,
  VITE_AUTH0_CLIENT_ID: AUTH0_CLIENT_ID,
  VITE_AUTH0_AUDIENCE: API_AUDIENCE,
  VITE_MOCKS: 'false',
};

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
    // The mocks answer through Playwright: no MSW worker in the page.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    // Phone first: the smallest supported width, with touch.
    {
      name: 'mobile',
      testIgnore: PWA_SPEC,
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } },
    },
    { name: 'desktop', testIgnore: PWA_SPEC, use: { ...devices['Desktop Chrome'] } },
    // The installable app on a phone, its service worker allowed.
    {
      name: 'pwa',
      testMatch: PWA_SPEC,
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 360, height: 780 },
        baseURL: `http://localhost:${PWA_PORT}`,
        serviceWorkers: 'allow',
      },
    },
  ],
  // Always their own servers: one started by hand would carry the .env values
  // (real Auth0 and API) instead of the test ones.
  webServer: [
    {
      command: `pnpm exec vite --port ${PORT} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      env,
    },
    {
      // Built apart from dist, which the deployment uses.
      command: `pnpm exec vite build --outDir ${PWA_DIST} --emptyOutDir && pnpm exec vite preview --outDir ${PWA_DIST} --port ${PWA_PORT} --strictPort`,
      url: `http://localhost:${PWA_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env,
    },
  ],
});
