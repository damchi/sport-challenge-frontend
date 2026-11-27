import { useState } from 'react';
import i18n from 'i18next';
import { changeLanguage, initI18n, pickLanguage, type Language } from '../i18n';

/**
 * Starts the translations in the device's language, and keeps the page's
 * lang attribute in step with it (screen readers and hyphenation read it).
 * Resolves once the language's texts are there; returns the cleanup.
 */
export async function startLanguage(): Promise<() => void> {
  const syncLang = (language: string) => {
    document.documentElement.lang = language;
  };
  i18n.on('languageChanged', syncLang);
  const stop = () => i18n.off('languageChanged', syncLang);
  try {
    await initI18n(pickLanguage(navigator.languages));
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}

/**
 * A language chosen on screen: applied once its texts are downloaded. When
 * they cannot be (offline), the current language stays and `failed` says so,
 * until the next choice. `choose` resolves to whether the language applied
 * (not when another one was chosen meanwhile).
 */
export function useLanguageChoice(): {
  choose: (language: Language) => Promise<boolean>;
  failed: boolean;
} {
  const [failed, setFailed] = useState(false);
  const choose = async (language: Language) => {
    setFailed(false);
    try {
      return await changeLanguage(language);
    } catch {
      setFailed(true);
      return false;
    }
  };
  return { choose, failed };
}
