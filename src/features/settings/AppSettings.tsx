import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useUpdateMe } from '../../api/hooks/useMe';
import { SUPPORTED_LANGUAGES, type Language } from '../../i18n';
import { useSignOut } from '../../lib/auth/useSignOut';
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '../../lib/theme';

const THEMES: ThemeChoice[] = ['system', 'light', 'dark'];

const OPTION =
  'flex h-11 flex-1 items-center gap-2 rounded-row border border-border bg-surface px-3 has-[:checked]:border-2 has-[:checked]:border-accent';

/**
 * Settings of the profile tab: language (kept in the profile), theme (kept on
 * the device) and sign-out.
 */
export function AppSettings() {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const theme = useThemeChoice();
  const signOut = useSignOut();
  // Sign-out could not start (network...): it can be tried again.
  const [signOutFailed, setSignOutFailed] = useState(false);
  const trySignOut = () => {
    setSignOutFailed(false);
    signOut().catch(() => setSignOutFailed(true));
  };

  const chooseLanguage = (language: Language) => {
    void i18n.changeLanguage(language);
    updateMe.mutate({ language });
  };
  const current = i18n.resolvedLanguage;

  // The language could not be kept in the profile: the next load would bring
  // the previous one back.
  const saveError =
    updateMe.error instanceof ApiError
      ? errorMessage(updateMe.error, (candidate) => i18n.exists(candidate))
      : updateMe.error
        ? { key: 'errors.unknown', values: {} }
        : undefined;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <fieldset>
        <legend className="text-sm font-semibold">{t('onboarding.language.label')}</legend>
        <div className="mt-2 flex gap-3">
          {SUPPORTED_LANGUAGES.map((language) => (
            <label key={language} className={OPTION}>
              <input
                type="radio"
                name="language"
                value={language}
                checked={current === language}
                onChange={() => chooseLanguage(language)}
              />
              <span lang={language}>{t(`onboarding.language.${language}`)}</span>
            </label>
          ))}
        </div>
        {saveError && (
          <div className="mt-2 flex items-center gap-3">
            <p role="alert" className="flex-1 text-sm text-risk-fg">
              {t(saveError.key, saveError.values)}
            </p>
            <button
              type="button"
              onClick={() => updateMe.variables && updateMe.mutate(updateMe.variables)}
              className="h-11 rounded-full border border-border bg-surface px-4 text-sm font-bold"
            >
              {t('errorPage.retry')}
            </button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">{t('settings.theme.label')}</legend>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {THEMES.map((choice) => (
            <label key={choice} className={OPTION}>
              <input
                type="radio"
                name="theme"
                value={choice}
                checked={theme === choice}
                onChange={() => setThemeChoice(choice)}
              />
              <span>{t(`settings.theme.${choice}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={trySignOut}
        className="h-11 rounded-full border border-border bg-surface px-6 text-button font-bold"
      >
        {t('settings.signOut')}
      </button>
      {signOutFailed && (
        <p role="alert" className="-mt-4 text-sm text-risk-fg">
          {t('errors.unknown')}
        </p>
      )}
    </div>
  );
}
