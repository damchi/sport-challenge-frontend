import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useUpdateMe, type Me } from '../../api/hooks/useMe';
import { Segmented } from '../../components/Segmented';
import { profileSchema, profileUpdate, type ProfileInput } from '../../domain/schemas/profile';
import { SUPPORTED_LANGUAGES, type Language } from '../../i18n';
import { NameInput } from './NameInput';
import { OnboardingPreview } from './OnboardingPreview';
import { fieldErrors } from './profileErrors';

/**
 * First profile: a preview of the name others will see, first and last name
 * (required), pseudo (optional, shown instead of the names when set), all
 * checked as typed, and language, applied as soon as it is chosen. Also
 * shown to a profile made before the names were asked, with what it already
 * has (its pseudo can be changed or removed). On success the
 * server says whether the profile is complete, and the profile gate opens
 * the app.
 */
export function OnboardingForm({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    // Checked once the field is left, then at each keystroke.
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      pseudo: me.pseudo ?? '',
      first_name: me.first_name ?? '',
      last_name: me.last_name ?? '',
      language: me.language ?? (i18n.language === 'en' ? 'en' : 'fr'),
    },
  });

  const onSubmit = async (profile: ProfileInput) => {
    setFormError(undefined);
    try {
      await updateMe.mutateAsync(profileUpdate(profile, me.pseudo));
      // The profile is saved: a failed language switch is not a form error.
      i18n.changeLanguage(profile.language).catch(() => undefined);
    } catch (error) {
      const invalid = fieldErrors(error);
      if (invalid.length > 0) {
        invalid.forEach(([field, message], index) =>
          setError(field, { message }, { shouldFocus: index === 0 }),
        );
      } else {
        const { key, values } =
          error instanceof ApiError
            ? errorMessage(error, (candidate) => i18n.exists(candidate))
            : { key: 'errors.unknown', values: {} };
        setFormError(t(key, values));
      }
    }
  };

  const [pseudo, firstName, lastName, language] = useWatch({
    control,
    name: ['pseudo', 'first_name', 'last_name', 'language'],
  });
  const pseudoMessage = errors.pseudo?.message;
  const pseudoDescribedBy = ['pseudo-hint', pseudoMessage && 'pseudo-error']
    .filter(Boolean)
    .join(' ');

  // The interface follows the language as soon as it is chosen; the profile
  // keeps it once sent.
  const chooseLanguage = (chosen: Language) => {
    setValue('language', chosen);
    i18n.changeLanguage(chosen).catch(() => undefined);
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="mt-6 flex flex-col gap-6"
    >
      <OnboardingPreview
        userId={me.id}
        user={{ pseudo: pseudo.trim(), first_name: firstName.trim(), last_name: lastName.trim() }}
      />

      <div className="grid gap-6 md:grid-cols-2 md:gap-4">
        <NameInput
          name="first_name"
          label={t('onboarding.firstName')}
          autoComplete="given-name"
          message={errors.first_name?.message}
          registration={register('first_name')}
        />
        <NameInput
          name="last_name"
          label={t('onboarding.lastName')}
          autoComplete="family-name"
          message={errors.last_name?.message}
          registration={register('last_name')}
        />
      </div>

      <div>
        <label htmlFor="pseudo" className="block text-sm font-semibold">
          {t('onboarding.pseudo.name')}{' '}
          <span className="font-normal text-muted">{t('onboarding.pseudo.optional')}</span>
        </label>
        <div className="mt-2 flex h-11 items-center gap-1 rounded-row border border-border bg-surface px-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent">
          <span aria-hidden="true" className="text-muted">
            {t('profile.at')}
          </span>
          <input
            id="pseudo"
            autoComplete="nickname"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t('onboarding.pseudo.placeholder')}
            aria-invalid={pseudoMessage ? true : undefined}
            aria-describedby={pseudoDescribedBy}
            className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
            {...register('pseudo')}
          />
        </div>
        <p id="pseudo-hint" className="mt-1 text-sm text-muted">
          {t('onboarding.pseudo.help')}
        </p>
        {pseudoMessage && (
          <p id="pseudo-error" role="alert" className="mt-1 text-sm text-risk-fg">
            {t(pseudoMessage)}
          </p>
        )}
      </div>

      <Segmented
        legend={t('onboarding.language.label')}
        options={SUPPORTED_LANGUAGES}
        selected={language}
        onSelect={chooseLanguage}
        label={(option) => t(`onboarding.language.${option}`)}
        lang={(option) => option}
      />

      <div>
        {formError && (
          <p role="alert" className="mb-4 text-sm text-risk-fg">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="h-13 w-full rounded-full bg-accent px-6 text-button font-bold text-on-accent disabled:opacity-60"
        >
          {isSubmitting ? t('onboarding.saving') : t('onboarding.submit')}
        </button>
        <p className="mt-3 text-center text-sm text-muted">{t('onboarding.later')}</p>
      </div>
    </form>
  );
}
