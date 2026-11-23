import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useUpdateMe, type Me } from '../../api/hooks/useMe';
import { identitySchema, identityUpdate, type IdentityInput } from '../../domain/schemas/profile';
import { NameInput } from './NameInput';
import { fieldErrors } from './profileErrors';
import { PROFILE_CARD } from './profileCard';

/**
 * What others see of the user: first and last name (required, changeable,
 * never removed) and pseudo (optional, removed when emptied), saved together
 * with the onboarding's rules and errors; then the e-mail, read-only as
 * GET /me gives it (it comes from the sign-in), said missing when absent.
 */
export function ProfileIdentity({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<IdentityInput>({
    resolver: zodResolver(identitySchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      first_name: me.first_name ?? '',
      last_name: me.last_name ?? '',
      pseudo: me.pseudo ?? '',
    },
  });
  const [firstName, lastName, pseudo] = useWatch({
    control,
    name: ['first_name', 'last_name', 'pseudo'],
  });
  const unchanged =
    Object.keys(identityUpdate({ first_name: firstName, last_name: lastName, pseudo }, me))
      .length === 0;

  const onSubmit = async (identity: IdentityInput) => {
    setFormError(undefined);
    setSaved(false);
    try {
      await updateMe.mutateAsync(identityUpdate(identity, me));
      setSaved(true);
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

  const onChange = () => setSaved(false);
  const pseudoMessage = errors.pseudo?.message;
  const pseudoDescribedBy = ['profile-pseudo-hint', pseudoMessage && 'profile-pseudo-error']
    .filter(Boolean)
    .join(' ');

  return (
    <section aria-labelledby="identity-title" className={PROFILE_CARD}>
      <h2 id="identity-title" className="font-display text-lg font-bold">
        {t('profile.identity.title')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('profile.identity.subtitle')}</p>

      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        noValidate
        className="mt-5 flex flex-col gap-5"
      >
        <div className="grid gap-5 md:grid-cols-2 md:gap-4">
          <NameInput
            name="first_name"
            label={t('onboarding.firstName')}
            autoComplete="given-name"
            message={errors.first_name?.message}
            registration={register('first_name', { onChange })}
          />
          <NameInput
            name="last_name"
            label={t('onboarding.lastName')}
            autoComplete="family-name"
            message={errors.last_name?.message}
            registration={register('last_name', { onChange })}
          />
        </div>

        <div>
          <label htmlFor="profile-pseudo" className="block text-sm font-semibold">
            {t('onboarding.pseudo.label')}
          </label>
          <div className="mt-2 flex h-11 items-center gap-1 rounded-row border border-border bg-surface px-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent">
            <span aria-hidden="true" className="text-muted">
              {t('profile.at')}
            </span>
            <input
              id="profile-pseudo"
              autoComplete="nickname"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={pseudoMessage ? true : undefined}
              aria-describedby={pseudoDescribedBy}
              className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none"
              {...register('pseudo', { onChange })}
            />
          </div>
          <p id="profile-pseudo-hint" className="mt-1 text-sm text-muted">
            {t('onboarding.pseudo.hint')}
          </p>
          {pseudoMessage && (
            <p id="profile-pseudo-error" role="alert" className="mt-1 text-sm text-risk-fg">
              {t(pseudoMessage)}
            </p>
          )}
        </div>

        <dl className="rounded-row bg-bg p-4">
          <dt className="text-sm font-semibold">{t('profile.identity.email')}</dt>
          <dd className={`mt-1 break-words ${me.email === null ? 'text-muted' : ''}`}>
            {me.email ?? t('profile.identity.missing')}
          </dd>
          <dd className="mt-1 text-sm text-muted">{t('profile.identity.emailHint')}</dd>
        </dl>

        {formError && (
          <p role="alert" className="text-sm text-risk-fg">
            {formError}
          </p>
        )}
        <div className="flex flex-col gap-3 md:flex-row-reverse md:items-center">
          <button
            type="submit"
            disabled={isSubmitting || unchanged}
            aria-busy={isSubmitting}
            className="h-12 rounded-full bg-accent hover-accent px-6 text-button font-bold text-on-accent disabled:opacity-60"
          >
            {isSubmitting ? t('onboarding.saving') : t('profile.save')}
          </button>
          <p role="status" className="text-sm text-muted md:flex-1 md:text-right">
            {saved && t('profile.saved')}
          </p>
        </div>
      </form>
    </section>
  );
}
