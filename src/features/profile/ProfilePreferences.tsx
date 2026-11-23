import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useUpdateMe } from '../../api/hooks/useMe';
import { Segmented } from '../../components/Segmented';
import { SUPPORTED_LANGUAGES, type Language } from '../../i18n';
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '../../lib/theme';
import { PROFILE_CARD } from './profileCard';

const THEMES: ThemeChoice[] = ['system', 'light', 'dark'];

/**
 * Preferences of the profile tab, applied right away: language (kept in the
 * profile) and theme (kept on the device).
 */
export function ProfilePreferences() {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const theme = useThemeChoice();

  const chooseLanguage = (language: Language) => {
    void i18n.changeLanguage(language);
    updateMe.mutate({ language });
  };

  // The language could not be kept in the profile: the next load would bring
  // the previous one back.
  const saveError =
    updateMe.error instanceof ApiError
      ? errorMessage(updateMe.error, (candidate) => i18n.exists(candidate))
      : updateMe.error
        ? { key: 'errors.unknown', values: {} }
        : undefined;

  return (
    <section aria-labelledby="preferences-title" className={PROFILE_CARD}>
      <h2 id="preferences-title" className="font-display text-lg font-bold">
        {t('profile.preferences.title')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('profile.preferences.subtitle')}</p>

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <Segmented
            legend={t('onboarding.language.label')}
            options={SUPPORTED_LANGUAGES}
            selected={i18n.resolvedLanguage}
            onSelect={chooseLanguage}
            label={(language) => t(`onboarding.language.${language}`)}
            lang={(language) => language}
          />
          {saveError && (
            <div className="mt-2 flex items-center gap-3">
              <p role="alert" className="flex-1 text-sm text-risk-fg">
                {t(saveError.key, saveError.values)}
              </p>
              <button
                type="button"
                onClick={() => updateMe.variables && updateMe.mutate(updateMe.variables)}
                className="h-11 rounded-full border border-border bg-surface hover-fill px-4 text-sm font-bold"
              >
                {t('errorPage.retry')}
              </button>
            </div>
          )}
        </div>

        <Segmented
          legend={t('settings.theme.label')}
          options={THEMES}
          selected={theme}
          onSelect={setThemeChoice}
          label={(choice) => t(`settings.theme.${choice}`)}
        />
      </div>
    </section>
  );
}
