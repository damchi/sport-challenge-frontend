// Checks of the translation files: the same keys in every language, and every
// plural form a language needs. Plural keys are compared by their base key,
// since languages need different forms (French has `many`, English not).
// Ordinal keys (`rank_ordinal_one`, i18next's `ordinal: true`) need the
// language's ordinal forms (English has `two` and `few`, French not).

const PLURAL_SUFFIX = /_(?:ordinal_)?(zero|one|two|few|many|other)$/;
const ORDINAL_SUFFIX = /_ordinal_(zero|one|two|few|many|other)$/;

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
  const present = new Set(paths);
  const forms = (type: Intl.PluralRuleType, keys: string[], infix: string) => {
    const bases = new Set(keys.map((path) => path.replace(PLURAL_SUFFIX, '')));
    const needed = new Intl.PluralRules(language, { type }).resolvedOptions().pluralCategories;
    return [...bases].flatMap((base) => needed.map((form) => `${base}${infix}${form}`));
  };
  const plural = paths.filter((path) => PLURAL_SUFFIX.test(path));
  const ordinal = plural.filter((path) => ORDINAL_SUFFIX.test(path));
  const cardinal = plural.filter((path) => !ORDINAL_SUFFIX.test(path));
  return [...forms('ordinal', ordinal, '_ordinal_'), ...forms('cardinal', cardinal, '_')]
    .filter((path) => !present.has(path))
    .sort();
}
