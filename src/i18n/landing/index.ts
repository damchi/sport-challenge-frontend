import i18n from 'i18next';
import en from './en.json';
import fr from './fr.json';

/**
 * The texts of the public landing page (`landing.*`), apart from the app's:
 * they come with the landing page's chunk, never in what a signed-in user
 * downloads.
 */
export function addLandingTranslations(): void {
  i18n.addResourceBundle('fr', 'translation', { landing: fr }, true, false);
  i18n.addResourceBundle('en', 'translation', { landing: en }, true, false);
}
