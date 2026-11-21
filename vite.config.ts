import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { msw } from 'msw/vite';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Serves the mock worker to the development server only: never in a build.
    command === 'serve' && msw({ mode: 'worker-only' }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // The journeys of e2e/ run with Playwright (pnpm e2e).
    exclude: [...configDefaults.exclude, 'e2e/**'],
    env: {
      VITE_API_URL: 'https://api.test',
      VITE_AUTH0_DOMAIN: 'auth.test',
      VITE_AUTH0_CLIENT_ID: 'test-client-id',
      VITE_AUTH0_AUDIENCE: 'https://api.test',
    },
    // Without it, Vitest loads CSS as empty: tokens.test.ts reads the tokens.
    css: { include: [/tokens\.css/] },
  },
}));
