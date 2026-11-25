import { useTranslation } from 'react-i18next';
import { AppMark } from '../../components/AppMark';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { useLanguageChoice } from '../../lib/language';
import { LANDING_CONTAINER } from './styles';

/** The app's name, the language in full and the year (`now`: injected by tests). */
export function LandingFooter({ now = new Date() }: { now?: Date }) {
  const { t, i18n } = useTranslation();
  const { choose, failed } = useLanguageChoice();
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
                  onClick={() => void choose(language)}
                  className="flex h-11 items-center rounded-tab px-2 hover-ink aria-pressed:font-bold aria-pressed:text-ink"
                >
                  {t(`onboarding.language.${language}`)}
                </button>
              </li>
            ))}
          </ul>
          <span>{t('landing.footer.copyright', { year: now.getFullYear() })}</span>
        </div>
        {failed && (
          <p role="alert" className="w-full text-risk-fg">
            {t('errors.language_unavailable')}
          </p>
        )}
      </div>
    </footer>
  );
}
