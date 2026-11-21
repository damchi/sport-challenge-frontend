// Fails when the production build exceeds its size budget (scripts/bundleBudget.ts).
// Run after pnpm build; part of the CI.
//
// Usage: pnpm bundle:check

import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { initialAssets, overBudget, summary, type Asset } from './bundleBudget.ts';

const assets: Asset[] = readdirSync('dist/assets')
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
  .map((name) => ({
    path: `/assets/${name}`,
    gzipBytes: gzipSync(readFileSync(`dist/assets/${name}`)).length,
  }));
const initial = initialAssets(readFileSync('dist/index.html', 'utf8'));

console.log(summary(assets, initial));
const report = overBudget(assets, initial);
if (report.length > 0) {
  console.error(`Over the bundle budget:\n${report.join('\n')}`);
  process.exit(1);
}
