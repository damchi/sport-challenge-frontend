import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Language of a device that speaks none of the supported ones. */
export const FALLBACK_LANGUAGE: Language = 'en';

function isSupported(code: string): code is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/**
 * First supported language among the device's preferred ones (BCP 47 tags,
 * most preferred first): fr-CA gives fr, es then en-US gives en.
 */
export function pickLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const code = tag.toLowerCase().split('-')[0] ?? '';
    if (isSupported(code)) return code;
  }
  return FALLBACK_LANGUAGE;
}

type Texts = Record<string, unknown>;

/**
 * Each language's texts in a chunk of its own: a user downloads the one they
 * read, the other one only when they choose it.
 */
const LOADERS: Record<Language, () => Promise<{ default: Texts }>> = {
  fr: () => import('./fr.json'),
  en: () => import('./en.json'),
};

/** The downloads started, kept but for a failed one, which can be tried again. */
const loading = new Map<Language, Promise<void>>();

/**
 * Downloads a language's texts once. Merged into what is already there: the
 * landing page and the admin section add their own texts apart.
 */
export function loadLanguage(language: Language): Promise<void> {
  const started = loading.get(language);
  if (started) return started;
  const download = LOADERS[language]().then(
    ({ default: texts }) => {
      i18n.addResourceBundle(language, 'translation', texts, true, false);
    },
    (error: unknown) => {
      loading.delete(language);
      throw error;
    },
  );
  loading.set(language, download);
  return download;
}

/**
 * Starts i18next in the given language, ready once its texts are there.
 * Starting again (tests) drops the texts already loaded.
 */
export async function initI18n(language: Language): Promise<void> {
  loading.clear();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    // The texts come with loadLanguage, not at init.
    resources: {},
    partialBundledLanguages: true,
    // React already escapes what it renders.
    interpolation: { escapeValue: false },
  });
  await loadLanguage(language);
}

/** The language last asked for: it wins over one asked before it that loads later. */
let lastAsked: Language | undefined;

/**
 * Switches to a language once its texts are there; resolves to false when
 * another one was asked for meanwhile, which then applies instead. A failed
 * download (offline) rejects and leaves the current language as it was.
 */
export async function changeLanguage(language: Language): Promise<boolean> {
  lastAsked = language;
  await loadLanguage(language);
  if (lastAsked !== language) return false;
  await i18n.changeLanguage(language);
  return true;
}
