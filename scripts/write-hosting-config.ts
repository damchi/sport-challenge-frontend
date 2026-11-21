// Writes firebase.json for the build in dist/ (scripts/hostingConfig.ts), with
// the same VITE_* values as the build. Run by the deploy workflow after
// pnpm build; firebase.json is not versioned.
//
// Usage: pnpm hosting:config

import { readFileSync, writeFileSync } from 'node:fs';
import { hostingConfig } from './hostingConfig.ts';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

const config = hostingConfig(
  {
    VITE_API_URL: required('VITE_API_URL'),
    VITE_AUTH0_DOMAIN: required('VITE_AUTH0_DOMAIN'),
    VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN || undefined,
  },
  readFileSync('dist/index.html', 'utf8'),
);
writeFileSync('firebase.json', `${JSON.stringify(config, null, 2)}\n`);
console.log('firebase.json written');
