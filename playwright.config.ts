import { defineConfig, devices } from '@playwright/test';
import { API_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN } from './e2e/fakeAuth0';

// End-to-end journeys against the development server, with the API and
// Auth0 mocked in the test run (e2e/fixtures.ts): no real service is called.
const PORT = 5180;
const baseURL = `http://localhost:${PORT}`;
const CI = process.env.CI === 'true';

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
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: baseURL,
    // Always its own server: one started by hand would carry the .env values
    // (real Auth0 and API) instead of the test ones below.
    reuseExistingServer: false,
    // Public test values only; they win over the .env files.
    env: {
      VITE_API_URL: 'https://api.e2e.test',
      VITE_AUTH0_DOMAIN: AUTH0_DOMAIN,
      VITE_AUTH0_CLIENT_ID: AUTH0_CLIENT_ID,
      VITE_AUTH0_AUDIENCE: API_AUDIENCE,
      VITE_MOCKS: 'false',
    },
  },
});
