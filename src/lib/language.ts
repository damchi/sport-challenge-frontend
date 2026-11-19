import i18n from 'i18next';
import { initI18n, pickLanguage } from '../i18n';

/**
 * Starts the translations in the device's language, and keeps the page's
 * lang attribute in step with it (screen readers and hyphenation read it).
 * The choice saved in the profile comes with SC-WEB-040. Returns the cleanup.
 */
export function startLanguage(): () => void {
  const syncLang = (language: string) => {
    document.documentElement.lang = language;
  };
  i18n.on('languageChanged', syncLang);
  // Old browsers only have navigator.language.
  const preferred = navigator.languages ?? [navigator.language];
  initI18n(pickLanguage(preferred));
  return () => i18n.off('languageChanged', syncLang);
}
