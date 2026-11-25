import { useTranslation } from 'react-i18next';
import { Segmented } from '../../components/Segmented';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { useLanguageChoice } from '../../lib/language';

/**
 * FR / EN, for the visit only: a visitor has no profile to keep it in, and
 * the next visit starts in the device's language again. A language that
 * cannot be downloaded says so under the switch.
 */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const { choose, failed } = useLanguageChoice();
  return (
    <div className="relative w-28">
      <Segmented
        legend={t('onboarding.language.label')}
        hideLegend
        options={SUPPORTED_LANGUAGES}
        selected={i18n.resolvedLanguage}
        onSelect={(language) => void choose(language)}
        label={(language) => (
          <>
            {/* The code on screen, the language's name for screen readers. */}
            <span aria-hidden="true">{language.toUpperCase()}</span>
            <span className="sr-only">{t(`onboarding.language.${language}`)}</span>
          </>
        )}
        lang={(language) => language}
      />
      {failed && (
        <p
          role="alert"
          className="absolute right-0 top-full z-10 mt-2 w-max max-w-[calc(100vw-2.5rem)] rounded-card border border-border bg-surface p-3 text-sm text-risk-fg shadow-[0_4px_16px_rgba(22,24,29,.12)]"
        >
          {t('errors.language_unavailable')}
        </p>
      )}
    </div>
  );
}
