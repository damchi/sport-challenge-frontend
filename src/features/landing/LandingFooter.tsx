import { useTranslation } from 'react-i18next';
import { AppMark } from '../../components/AppMark';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { LANDING_CONTAINER } from './styles';

/** The app's name, the language in full and the year. */
export function LandingFooter() {
  const { t, i18n } = useTranslation();
  return (
    <footer className="border-t border-border">
      <div
        className={`${LANDING_CONTAINER} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6 text-sm text-muted`}
      >
        <p className="flex flex-wrap items-center gap-2">
          <AppMark />
          <span className="font-bold text-ink">{t('home.title')}</span>
          <span>· {t('landing.footer.tagline')}</span>
        </p>
        <div className="flex items-center gap-4">
          <ul aria-label={t('onboarding.language.label')} className="flex items-center">
            {SUPPORTED_LANGUAGES.map((language) => (
              <li key={language}>
                <button
                  type="button"
                  lang={language}
                  aria-pressed={i18n.resolvedLanguage === language}
                  onClick={() => void i18n.changeLanguage(language)}
                  className="flex h-11 items-center rounded-tab px-2 hover-ink aria-pressed:font-bold aria-pressed:text-ink"
                >
                  {t(`onboarding.language.${language}`)}
                </button>
              </li>
            ))}
          </ul>
          <span>{t('landing.footer.copyright')}</span>
        </div>
      </div>
    </footer>
  );
}
