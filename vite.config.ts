/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    env: { VITE_API_URL: 'https://api.test' },
    // Without it, Vitest loads CSS as empty: tokens.test.ts reads the tokens.
    css: { include: [/tokens\.css/] },
  },
});
