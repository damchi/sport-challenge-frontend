// Checks of the translation files: the same keys in every language, and every
// plural form a language needs. Plural keys are compared by their base key,
// since languages need different forms (French has `many`, English not).

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function keyPaths(messages: unknown, prefix = ''): string[] {
  if (typeof messages !== 'object' || messages === null) return [prefix];
  return Object.entries(messages).flatMap(([key, value]) =>
    keyPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

function baseKeys(messages: unknown): Set<string> {
  return new Set(keyPaths(messages).map((path) => path.replace(PLURAL_SUFFIX, '')));
}

/** Keys of `reference` that `other` lacks, plural forms compared by base key. */
export function missingKeys(reference: unknown, other: unknown): string[] {
  const present = baseKeys(other);
  return [...baseKeys(reference)].filter((key) => !present.has(key)).sort();
}

/** Plural forms the language needs (Intl.PluralRules) that a plural key lacks. */
export function missingPluralForms(messages: unknown, language: string): string[] {
  const paths = keyPaths(messages);
  const pluralBases = new Set(
    paths.filter((path) => PLURAL_SUFFIX.test(path)).map((path) => path.replace(PLURAL_SUFFIX, '')),
  );
  const needed = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
  const present = new Set(paths);
  return [...pluralBases]
    .flatMap((base) => needed.map((form) => `${base}_${form}`))
    .filter((path) => !present.has(path))
    .sort();
}
