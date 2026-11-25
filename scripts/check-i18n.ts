// Fails when the French and English translation files do not have the same
// keys, or a plural key lacks a form its language needs: the app's
// (src/i18n), the landing page's (src/i18n/landing) and the admin section's
// (src/i18n/admin). Part of pnpm check.
//
// Usage: pnpm i18n:check

import { readFileSync } from 'node:fs';
import { missingKeys, missingPluralForms } from '../src/i18n/parity.ts';

function load(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const report = ['src/i18n', 'src/i18n/landing', 'src/i18n/admin'].flatMap((folder) => {
  const fr = load(`${folder}/fr.json`);
  const en = load(`${folder}/en.json`);
  return [
    ...missingKeys(fr, en).map((key) => `missing in ${folder}/en.json: ${key}`),
    ...missingKeys(en, fr).map((key) => `missing in ${folder}/fr.json: ${key}`),
    ...missingPluralForms(fr, 'fr').map(
      (key) => `plural form missing in ${folder}/fr.json: ${key}`,
    ),
    ...missingPluralForms(en, 'en').map(
      (key) => `plural form missing in ${folder}/en.json: ${key}`,
    ),
  ];
});

if (report.length > 0) {
  console.error(report.join('\n'));
  process.exit(1);
}
console.log(
  'fr.json and en.json have the same keys and every plural form (app, landing page and admin section).',
);
