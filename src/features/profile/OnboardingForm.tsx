import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useUpdateMe, type Me } from '../../api/hooks/useMe';
import { Avatar } from '../../components/Avatar';
import { profileSchema, type ProfileInput } from '../../domain/schemas/profile';

type ProfileField = 'pseudo' | 'first_name' | 'last_name';

const NAME_FIELDS = ['first_name', 'last_name'] as const;

// Fields a validation_failed answer names, with their message. For the
// pseudo, 409 means taken (contract); a 400 gives no reason, so the message
// stays generic.
function fieldErrors(error: unknown): [ProfileField, string][] {
  if (!(error instanceof ApiError) || error.code !== 'validation_failed') return [];
  const fields = (error.params.fields ?? '').split(',');
  const errors: [ProfileField, string][] = [];
  if (fields.includes('pseudo')) {
    errors.push([
      'pseudo',
      error.status === 409 ? 'profile.pseudo.taken' : 'profile.pseudo.invalid',
    ]);
  }
  for (const field of NAME_FIELDS) {
    if (fields.includes(field)) errors.push([field, 'profile.name.invalid']);
  }
  return errors;
}

/**
 * First profile: pseudo, first and last name (checked as typed) and
 * language. Also shown to a profile made before the names were asked, with
 * what it already has. On success the server says whether the profile is
 * complete, and the profile gate opens the app.
 */
export function OnboardingForm({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
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
      await updateMe.mutateAsync(profile);
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

  const pseudo = useWatch({ control, name: 'pseudo' });
  const pseudoMessage = errors.pseudo?.message;

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="mt-6">
      <label htmlFor="pseudo" className="block text-sm font-semibold">
        {t('onboarding.pseudo.label')}
      </label>
      <div className="mt-2 flex items-center gap-3">
        <Avatar userId={me.id} pseudo={pseudo || '?'} />
        <input
          id="pseudo"
          autoComplete="nickname"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={pseudoMessage ? true : undefined}
          aria-describedby={pseudoMessage ? 'pseudo-hint pseudo-error' : 'pseudo-hint'}
          className="h-11 min-w-0 flex-1 rounded-row border border-border bg-surface px-3 text-ink"
          {...register('pseudo')}
        />
      </div>
      <p id="pseudo-hint" className="mt-1 text-sm text-muted">
        {t('onboarding.pseudo.hint')}
      </p>
      {pseudoMessage && (
        <p id="pseudo-error" role="alert" className="mt-1 text-sm text-risk-fg">
          {t(pseudoMessage)}
        </p>
      )}

      <NameInput
        name="first_name"
        label={t('onboarding.firstName')}
        autoComplete="given-name"
        message={errors.first_name?.message}
        register={register}
      />
      <NameInput
        name="last_name"
        label={t('onboarding.lastName')}
        autoComplete="family-name"
        message={errors.last_name?.message}
        register={register}
      />

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">{t('onboarding.language.label')}</legend>
        <div className="mt-2 flex gap-3">
          {(['fr', 'en'] as const).map((language) => (
            <label
              key={language}
              className="flex h-11 flex-1 items-center gap-2 rounded-row border border-border bg-surface px-3 has-[:checked]:border-2 has-[:checked]:border-accent"
            >
              <input type="radio" value={language} {...register('language')} />
              <span lang={language}>{t(`onboarding.language.${language}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="mt-4 text-sm text-risk-fg">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="mt-6 h-13 w-full rounded-full bg-accent px-6 text-button font-bold text-on-accent disabled:opacity-60"
      >
        {isSubmitting ? t('onboarding.saving') : t('onboarding.submit')}
      </button>
    </form>
  );
}

/** A required first or last name, its error read with the field. */
function NameInput({
  name,
  label,
  autoComplete,
  message,
  register,
}: {
  name: (typeof NAME_FIELDS)[number];
  label: string;
  autoComplete: string;
  message: string | undefined;
  register: UseFormRegister<ProfileInput>;
}) {
  const { t } = useTranslation();
  const errorId = `${name}-error`;
  return (
    <div className="mt-6">
      <label htmlFor={name} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        autoComplete={autoComplete}
        aria-required="true"
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        className="mt-2 h-11 w-full rounded-row border border-border bg-surface px-3 text-ink"
        {...register(name)}
      />
      {message && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-risk-fg">
          {t(message)}
        </p>
      )}
    </div>
  );
}
