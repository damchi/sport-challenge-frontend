import { useTranslation } from 'react-i18next';
import { Segmented } from '../../components/Segmented';
import { SUPPORTED_LANGUAGES } from '../../i18n';

/**
 * FR / EN, for the visit only: a visitor has no profile to keep it in, and
 * the next visit starts in the device's language again.
 */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div className="w-28">
      <Segmented
        legend={t('onboarding.language.label')}
        hideLegend
        options={SUPPORTED_LANGUAGES}
        selected={i18n.resolvedLanguage}
        onSelect={(language) => void i18n.changeLanguage(language)}
        label={(language) => (
          <>
            {/* The code on screen, the language's name for screen readers. */}
            <span aria-hidden="true">{language.toUpperCase()}</span>
            <span className="sr-only">{t(`onboarding.language.${language}`)}</span>
          </>
        )}
        lang={(language) => language}
      />
    </div>
  );
}
