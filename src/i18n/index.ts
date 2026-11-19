import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

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

/** Starts i18next in the given language; resources are bundled, so it is ready on return. */
export function initI18n(language: Language): void {
  void i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    // React already escapes what it renders.
    interpolation: { escapeValue: false },
  });
}
