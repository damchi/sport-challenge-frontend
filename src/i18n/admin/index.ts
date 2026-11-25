import i18n from 'i18next';
import en from './en.json';
import fr from './fr.json';

/**
 * The texts of the admin section (`admin.*`, but its title and the names of
 * its parts, which the routes and the profile use): they come with the
 * section's chunk, never in what every user downloads.
 */
export function addAdminTranslations(): void {
  i18n.addResourceBundle('fr', 'translation', { admin: fr }, true, false);
  i18n.addResourceBundle('en', 'translation', { admin: en }, true, false);
}
