import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useUpdateMe } from '../../api/hooks/useMe';
import { SUPPORTED_LANGUAGES, type Language } from '../../i18n';
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '../../lib/theme';
import { PROFILE_CARD } from './profileCard';

const THEMES: ThemeChoice[] = ['system', 'light', 'dark'];

const SEGMENT =
  'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-tab px-2 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
const SEGMENT_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const SEGMENT_OFF = 'text-muted';

/** A choice among a few options, as a segmented control of radio buttons (design.md). */
function Segmented<T extends string>({
  legend,
  options,
  selected,
  onSelect,
  label,
  lang,
}: {
  legend: string;
  options: readonly T[];
  selected: string | undefined;
  onSelect: (value: T) => void;
  label: (value: T) => string;
  lang?: (value: T) => string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="relative mt-2 flex rounded-row bg-segment p-1">
        {options.map((value) => {
          const on = value === selected;
          return (
            <label key={value} className={`${SEGMENT} ${on ? SEGMENT_ON : SEGMENT_OFF}`}>
              <input
                type="radio"
                name={name}
                value={value}
                checked={on}
                onChange={() => onSelect(value)}
                className="sr-only"
              />
              <span lang={lang?.(value)}>{label(value)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

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
                className="h-11 rounded-full border border-border bg-surface px-4 text-sm font-bold"
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
