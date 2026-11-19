// Fails when the French and English translation files do not have the same
// keys, or a plural key lacks a form its language needs. Part of pnpm check.
//
// Usage: pnpm i18n:check

import { readFileSync } from 'node:fs';
import { missingKeys, missingPluralForms } from '../src/i18n/parity.ts';

function load(language: string): unknown {
  return JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8'));
}

const fr = load('fr');
const en = load('en');
const report = [
  ...missingKeys(fr, en).map((key) => `missing in en.json: ${key}`),
  ...missingKeys(en, fr).map((key) => `missing in fr.json: ${key}`),
  ...missingPluralForms(fr, 'fr').map((key) => `plural form missing in fr.json: ${key}`),
  ...missingPluralForms(en, 'en').map((key) => `plural form missing in en.json: ${key}`),
];

if (report.length > 0) {
  console.error(report.join('\n'));
  process.exit(1);
}
console.log('fr.json and en.json have the same keys and every plural form.');
