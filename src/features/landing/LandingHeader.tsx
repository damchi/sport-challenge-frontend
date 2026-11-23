import { useTranslation } from 'react-i18next';
import { AppMark } from '../../components/AppMark';
import { LanguageSwitch } from './LanguageSwitch';
import { LANDING_CONTAINER, SECONDARY_BUTTON } from './styles';
import type { LandingSignIn } from './useLandingSignIn';

const SECTIONS = ['how', 'categories', 'sports', 'faq'] as const;

/** The app's name, the sections (web), the language and « Se connecter ». */
export function LandingHeader({ signIn }: { signIn: LandingSignIn }) {
  const { t } = useTranslation();
  return (
    <header className="border-b border-border bg-surface">
      <div
        className={`${LANDING_CONTAINER} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3`}
      >
        <p className="flex items-center gap-2.5 font-display text-xl font-bold">
          <AppMark />
          {t('home.title')}
        </p>
        <nav aria-label={t('landing.nav.label')} className="hidden lg:block">
          <ul className="flex gap-1">
            {SECTIONS.map((section) => (
              <li key={section}>
                <a
                  href={`#${section}`}
                  className="flex h-11 items-center rounded-tab px-3 text-sm font-semibold text-muted hover-ink"
                >
                  {t(`landing.nav.${section}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <LanguageSwitch />
          <button
            type="button"
            onClick={() => signIn.signIn('top')}
            disabled={signIn.pending}
            className={SECONDARY_BUTTON}
          >
            {t('auth.signIn')}
          </button>
        </div>
      </div>
    </header>
  );
}
