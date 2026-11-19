import { useTranslation } from 'react-i18next';

/**
 * Name of a sport of the catalogue in the user's language. A code added to
 * the catalogue before its translation shows as is rather than as a key.
 */
export function useSportName(): (code: string) => string {
  const { t, i18n } = useTranslation();
  return (code) => (i18n.exists(`sports.${code}`) ? t(`sports.${code}`) : code);
}
