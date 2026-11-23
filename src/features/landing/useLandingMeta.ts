import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The page's description in the active language (index.html has the French
 * one, for the link previews that do not run the app); restored on leaving.
 */
export function useLandingMeta(): void {
  const { t } = useTranslation();
  const description = t('landing.metaDescription');
  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) return;
    const previous = meta.getAttribute('content');
    meta.setAttribute('content', description);
    return () => {
      if (previous === null) meta.removeAttribute('content');
      else meta.setAttribute('content', previous);
    };
  }, [description]);
}
